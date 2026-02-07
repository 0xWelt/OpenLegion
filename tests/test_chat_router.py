"""Tests for chat_router module."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
import tomlkit.exceptions
from fastapi.testclient import TestClient
from kimi_agent_sdk import ApprovalRequest, RunCancelled, ToolResult
from kosong.message import TextPart, ThinkPart, ToolCall, ToolCallPart
from kosong.tooling import DisplayBlock, ToolReturnValue
from pydantic import ValidationError

from legion.chat_router import (
    ModelConfig,
    ProviderConfig,
    _flush_pending_tool_call,
    _process_wire_message,
    load_kimi_config,
)
from legion.conversations import (
    Conversation,
    UIMessageAssistant,
    UIMessageUser,
)
from legion.service import create_app


if TYPE_CHECKING:
    from fastapi import FastAPI


@pytest.fixture
def app() -> FastAPI:
    """Create test app with chat router."""
    return create_app()


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Create test client."""
    return TestClient(app)


class TestLoadKimiConfig:
    """Tests for load_kimi_config and config parsing."""

    def test_missing_config_returns_default(self) -> None:
        """When neither config.toml nor config.json exists, return default."""
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            with patch('legion.chat_router.Path.home', return_value=home):
                config = load_kimi_config()
        assert config.default_model == 'kimi-k2-0711'
        assert config.default_thinking is False
        assert config.models == {}
        assert config.providers == {}

    def test_toml_parses_models_and_providers(self) -> None:
        """Valid config.toml parses models and providers into typed structs."""
        toml_content = """
default_model = "kimi-k2-5"
default_thinking = true

[models.kimi-k2-5]
provider = "kimi-internal"
model = "kimi-k2.5"
max_context_size = 250000
capabilities = ["video_in", "image_in", "thinking"]

[providers.kimi-internal]
type = "kimi"
base_url = "https://api.msh.team/v1"
api_key = "sk-test"
"""
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            kimi_dir = home / '.kimi'
            kimi_dir.mkdir()
            (kimi_dir / 'config.toml').write_text(toml_content, encoding='utf-8')
            with patch('legion.chat_router.Path.home', return_value=home):
                config = load_kimi_config()
        assert config.default_model == 'kimi-k2-5'
        assert config.default_thinking is True
        assert 'kimi-k2-5' in config.models
        model = config.models['kimi-k2-5']
        assert isinstance(model, ModelConfig)
        assert model.provider == 'kimi-internal'
        assert model.model == 'kimi-k2.5'
        assert model.max_context_size == 250000
        assert model.capabilities == ['video_in', 'image_in', 'thinking']
        assert 'kimi-internal' in config.providers
        prov = config.providers['kimi-internal']
        assert isinstance(prov, ProviderConfig)
        assert prov.type == 'kimi'
        assert prov.base_url == 'https://api.msh.team/v1'
        assert prov.api_key == 'sk-test'

    def test_json_legacy_parses_models_and_providers(self) -> None:
        """Legacy config.json (no config.toml) parses models and providers."""
        json_content = """{
            "default_model": "gpt-5",
            "default_thinking": false,
            "models": {
                "gpt-5": {
                    "provider": "qianxun-responses",
                    "model": "gpt-5",
                    "max_context_size": 400000,
                    "capabilities": ["image_in", "thinking"]
                }
            },
            "providers": {
                "qianxun-responses": {
                    "type": "openai_responses",
                    "base_url": "https://openai.app.msh.team/raw/x/v1",
                    "api_key": "sk-json"
                }
            }
        }"""
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            kimi_dir = home / '.kimi'
            kimi_dir.mkdir()
            (kimi_dir / 'config.json').write_text(json_content, encoding='utf-8')
            with patch('legion.chat_router.Path.home', return_value=home):
                config = load_kimi_config()
        assert config.default_model == 'gpt-5'
        assert config.default_thinking is False
        assert 'gpt-5' in config.models
        assert config.models['gpt-5'].provider == 'qianxun-responses'
        assert config.models['gpt-5'].max_context_size == 400000
        assert 'qianxun-responses' in config.providers
        assert config.providers['qianxun-responses'].api_key == 'sk-json'

    def test_invalid_toml_raises(self) -> None:
        """Invalid config.toml raises (fail fast)."""
        with (
            tempfile.TemporaryDirectory() as tmp,
            patch('legion.chat_router.Path.home', return_value=Path(tmp)),
        ):
            home = Path(tmp)
            kimi_dir = home / '.kimi'
            kimi_dir.mkdir()
            (kimi_dir / 'config.toml').write_text('invalid toml [[[', encoding='utf-8')
            with pytest.raises(tomlkit.exceptions.ParseError):
                load_kimi_config()

    def test_invalid_json_legacy_raises(self) -> None:
        """Invalid config.json when no toml exists raises (fail fast)."""
        with (
            tempfile.TemporaryDirectory() as tmp,
            patch('legion.chat_router.Path.home', return_value=Path(tmp)),
        ):
            home = Path(tmp)
            kimi_dir = home / '.kimi'
            kimi_dir.mkdir()
            (kimi_dir / 'config.json').write_text('not json', encoding='utf-8')
            with pytest.raises(json.JSONDecodeError):
                load_kimi_config()

    def test_invalid_model_or_provider_raises(self) -> None:
        """Invalid model or provider entry raises (fail fast)."""
        toml_content = """
default_model = "good"
default_thinking = false

[models.good]
provider = "p"
model = "m"
max_context_size = 100

[models.bad]
not_a_valid_model = true

[providers.p]
type = "kimi"
base_url = "https://x"
api_key = "k"

[providers.bad]
missing_required = true
"""
        with (
            tempfile.TemporaryDirectory() as tmp,
            patch('legion.chat_router.Path.home', return_value=Path(tmp)),
        ):
            home = Path(tmp)
            kimi_dir = home / '.kimi'
            kimi_dir.mkdir()
            (kimi_dir / 'config.toml').write_text(toml_content, encoding='utf-8')
            with pytest.raises(ValidationError):
                load_kimi_config()


class TestListConversations:
    """Tests for GET /api/conversations endpoint."""

    @pytest.mark.anyio
    async def test_list_conversations_empty(self, client: TestClient) -> None:
        """Test listing conversations when none exist."""
        with patch(
            'legion.conversations.conversation_manager.list_conversations',
            return_value=[],
        ):
            response = client.get('/api/conversations')

        assert response.status_code == 200
        assert response.json() == {'conversations': []}

    @pytest.mark.anyio
    async def test_list_conversations_with_data(self, client: TestClient) -> None:
        """Test listing conversations with existing data."""
        mock_conv = Conversation(
            id='abc123',
            title='Test Chat',
            session_id='legion-conv-abc123',
            work_dir='/tmp/test',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T01:00:00',
            message_count=5,
        )

        with patch(
            'legion.conversations.conversation_manager.list_conversations',
            return_value=[mock_conv],
        ):
            response = client.get('/api/conversations')

        assert response.status_code == 200
        data = response.json()
        assert len(data['conversations']) == 1
        assert data['conversations'][0]['id'] == 'abc123'
        assert data['conversations'][0]['title'] == 'Test Chat'


class TestCreateConversation:
    """Tests for POST /api/conversations endpoint."""

    @pytest.mark.anyio
    async def test_create_conversation(self, client: TestClient) -> None:
        """Test creating a new conversation."""
        mock_conv = Conversation(
            id='new123',
            title='New Conversation',
            session_id='legion-conv-new123',
            work_dir='/tmp/new',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T00:00:00',
            message_count=0,
        )

        with patch(
            'legion.conversations.conversation_manager.create_conversation',
            return_value=mock_conv,
        ):
            response = client.post('/api/conversations', json={'title': 'Test Chat'})

        assert response.status_code == 200
        data = response.json()
        assert data['conversation']['id'] == 'new123'
        assert data['conversation']['title'] == 'New Conversation'


class TestGetConversation:
    """Tests for GET /api/conversations/{conv_id} endpoint."""

    @pytest.mark.anyio
    async def test_get_conversation_success(self, client: TestClient) -> None:
        """Test getting an existing conversation."""
        mock_conv = Conversation(
            id='get123',
            title='Get Test',
            session_id='legion-conv-get123',
            work_dir='/tmp/get',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T01:00:00',
            message_count=3,
        )

        with patch(
            'legion.conversations.conversation_manager.get_conversation',
            return_value=mock_conv,
        ):
            response = client.get('/api/conversations/get123')

        assert response.status_code == 200
        data = response.json()
        assert data['conversation']['id'] == 'get123'

    @pytest.mark.anyio
    async def test_get_conversation_not_found(self, client: TestClient) -> None:
        """Test getting non-existent conversation."""
        with patch(
            'legion.conversations.conversation_manager.get_conversation',
            return_value=None,
        ):
            response = client.get('/api/conversations/nonexistent')

        assert response.status_code == 404
        assert response.json()['error'] == 'Conversation not found'


class TestDeleteConversation:
    """Tests for DELETE /api/conversations/{conv_id} endpoint."""

    @pytest.mark.anyio
    async def test_delete_conversation_success(self, client: TestClient) -> None:
        """Test deleting an existing conversation."""
        with patch(
            'legion.conversations.conversation_manager.delete_conversation',
            return_value=True,
        ):
            response = client.delete('/api/conversations/del123')

        assert response.status_code == 200
        assert response.json()['success'] is True

    @pytest.mark.anyio
    async def test_delete_conversation_not_found(self, client: TestClient) -> None:
        """Test deleting non-existent conversation."""
        with patch(
            'legion.conversations.conversation_manager.delete_conversation',
            return_value=False,
        ):
            response = client.delete('/api/conversations/nonexistent')

        assert response.status_code == 404
        assert response.json()['error'] == 'Conversation not found'


class TestUpdateConversation:
    """Tests for PATCH /api/conversations/{conv_id} endpoint."""

    @pytest.mark.anyio
    async def test_update_conversation_success(self, client: TestClient) -> None:
        """Test updating an existing conversation."""
        mock_conv = Conversation(
            id='upd123',
            title='Updated Title',
            session_id='legion-conv-upd123',
            work_dir='/tmp/upd',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T02:00:00',
            message_count=10,
        )

        with patch(
            'legion.conversations.conversation_manager.update_conversation',
            return_value=mock_conv,
        ):
            response = client.patch(
                '/api/conversations/upd123',
                json={'title': 'Updated Title', 'message_count': 10},
            )

        assert response.status_code == 200
        data = response.json()
        assert data['conversation']['title'] == 'Updated Title'
        assert data['conversation']['message_count'] == 10

    @pytest.mark.anyio
    async def test_update_conversation_not_found(self, client: TestClient) -> None:
        """Test updating non-existent conversation."""
        with patch(
            'legion.conversations.conversation_manager.update_conversation',
            return_value=None,
        ):
            response = client.patch('/api/conversations/nonexistent', json={'title': 'Test'})

        assert response.status_code == 404
        assert response.json()['error'] == 'Conversation not found'


class TestGetConversationHistory:
    """Tests for GET /api/conversations/{conv_id}/history endpoint."""

    @pytest.mark.anyio
    async def test_get_history_success(self, client: TestClient) -> None:
        """Test getting conversation history."""
        mock_conv = Conversation(
            id='hist123',
            title='History Test',
            session_id='legion-conv-hist123',
            work_dir='/tmp/hist',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T01:00:00',
            message_count=2,
        )

        mock_history = [
            UIMessageUser(content='Hello'),
            UIMessageAssistant(content='Hi there', thinking=''),
        ]

        with (
            patch(
                'legion.conversations.conversation_manager.get_conversation',
                return_value=mock_conv,
            ),
            patch(
                'legion.conversations.conversation_manager.get_conversation_history',
                return_value=mock_history,
            ),
        ):
            response = client.get('/api/conversations/hist123/history')

        assert response.status_code == 200
        data = response.json()
        assert len(data['messages']) == 2
        assert data['messages'][0]['type'] == 'user'
        assert data['messages'][1]['type'] == 'assistant'

    @pytest.mark.anyio
    async def test_get_history_not_found(self, client: TestClient) -> None:
        """Test getting history for non-existent conversation."""
        with patch(
            'legion.conversations.conversation_manager.get_conversation',
            return_value=None,
        ):
            response = client.get('/api/conversations/nonexistent/history')

        assert response.status_code == 404
        assert response.json()['error'] == 'Conversation not found'


class TestUploadFile:
    """Tests for POST /api/conversations/{conv_id}/upload endpoint."""

    @pytest.mark.anyio
    async def test_upload_file_success(self, client: TestClient) -> None:
        """Test uploading a file."""
        mock_conv = Conversation(
            id='upload123',
            title='Upload Test',
            session_id='legion-conv-upload123',
            work_dir='/tmp/upload',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T01:00:00',
            message_count=0,
        )

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write('test content')
            f.flush()
            temp_path = f.name

        try:
            with (
                patch(
                    'legion.conversations.conversation_manager.get_conversation',
                    return_value=mock_conv,
                ),
                open(temp_path, 'rb') as file,  # noqa: ASYNC230
            ):
                response = client.post(
                    '/api/conversations/upload123/upload',
                    files={'file': ('test.txt', file, 'text/plain')},
                )

            assert response.status_code == 200
            data = response.json()
            assert 'url' in data
            assert data['filename'] == 'test.txt'
        finally:
            os.unlink(temp_path)

    @pytest.mark.anyio
    async def test_upload_file_not_found(self, client: TestClient) -> None:
        """Test uploading to non-existent conversation."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write('test content')
            f.flush()
            temp_path = f.name

        try:
            with (
                patch(
                    'legion.conversations.conversation_manager.get_conversation',
                    return_value=None,
                ),
                open(temp_path, 'rb') as file,  # noqa: ASYNC230
            ):
                response = client.post(
                    '/api/conversations/nonexistent/upload',
                    files={'file': ('test.txt', file, 'text/plain')},
                )

            assert response.status_code == 404
            assert response.json()['error'] == 'Conversation not found'
        finally:
            os.unlink(temp_path)


class TestWebSocketStopGeneration:
    """Tests for WebSocket stop generation functionality."""

    @pytest.mark.anyio
    async def test_stop_signal_ignored_when_no_session(self, client: TestClient) -> None:
        """Test that stop signal is ignored when no active session."""
        mock_conv = Conversation(
            id='stop-idle-123',
            title='Stop Idle Test',
            session_id='legion-conv-stop-idle-123',
            work_dir='/tmp/stop-idle-test',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T01:00:00',
            message_count=0,
        )

        async def mock_prompt_echo(*_args: object, **_kwargs: object):
            """Simulate generation that completes normally."""
            yield TextPart(text='Echo response')

        with (
            patch(
                'legion.conversations.conversation_manager.get_conversation',
                return_value=mock_conv,
            ),
            patch(
                'legion.conversations.conversation_manager.get_or_create_session',
            ) as mock_get_session,
            patch(
                'legion.conversations.conversation_manager.update_conversation',
            ),
            client.websocket_connect('/api/conversations/ws/stop-idle-123') as websocket,
        ):
            mock_session = AsyncMock()
            mock_session.prompt = mock_prompt_echo
            mock_get_session.return_value = mock_session

            # Send stop signal without starting generation
            websocket.send_json({'type': 'stop'})

            # The server should continue operating normally
            # Send a real message after stop
            websocket.send_json(
                {
                    'message': 'Hello after stop',
                    'thinking': False,
                    'model': 'test-model',
                }
            )

            # Should receive user confirmation
            response = websocket.receive_json()
            assert response['type'] == 'user'

            # Should be able to continue with normal flow
            response = websocket.receive_json()
            assert response['type'] in ['chunk', 'complete', 'error']

    @pytest.mark.anyio
    async def test_runcancelled_exception_handled(self, client: TestClient) -> None:
        """Test that RunCancelled exception is properly handled."""
        mock_conv = Conversation(
            id='runcancel-123',
            title='RunCancel Test',
            session_id='legion-conv-runcancel-123',
            work_dir='/tmp/runcancel-test',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T01:00:00',
            message_count=0,
        )

        async def mock_prompt_that_raises(*_args: object, **_kwargs: object):
            """Simulate generation that raises RunCancelled."""
            yield TextPart(text='Before cancel')
            err_msg = 'Test cancellation'
            raise RunCancelled(err_msg)

        with (
            patch(
                'legion.conversations.conversation_manager.get_conversation',
                return_value=mock_conv,
            ),
            patch(
                'legion.conversations.conversation_manager.get_or_create_session',
            ) as mock_get_session,
            patch(
                'legion.conversations.conversation_manager.update_conversation',
            ),
        ):
            mock_session = AsyncMock()
            mock_session.prompt = mock_prompt_that_raises
            mock_get_session.return_value = mock_session

            with client.websocket_connect('/api/conversations/ws/runcancel-123') as websocket:
                # Send a message
                websocket.send_json(
                    {
                        'message': 'Hello',
                        'thinking': False,
                        'model': 'test-model',
                    }
                )

                # Receive user confirmation
                response = websocket.receive_json()
                assert response['type'] == 'user'

                # Receive the message before cancellation
                response = websocket.receive_json()
                assert response['type'] == 'chunk'

                # Should receive complete (not error) when RunCancelled is raised
                response = websocket.receive_json()
                assert response['type'] == 'complete'


class TestProcessWireMessage:
    """Tests for _process_wire_message helper function."""

    @pytest.mark.anyio
    async def test_process_text_part(self) -> None:
        """Test processing TextPart message."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []
        pending_tool_call: list[ToolCall | None] = [None]

        wire_msg = TextPart(text='Hello world')
        await _process_wire_message(wire_msg, response_chunks, mock_ws, pending_tool_call)

        assert response_chunks == ['Hello world']
        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'chunk'
        assert call_args['content'] == 'Hello world'

    @pytest.mark.anyio
    async def test_process_think_part(self) -> None:
        """Test processing ThinkPart message."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []
        pending_tool_call: list[ToolCall | None] = [None]

        wire_msg = ThinkPart(think='Thinking about this...')
        await _process_wire_message(wire_msg, response_chunks, mock_ws, pending_tool_call)

        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'think'
        assert call_args['content'] == 'Thinking about this...'

    @pytest.mark.anyio
    async def test_process_tool_call(self) -> None:
        """Test processing ToolCall: stream start (arguments_raw) then complete (arguments)."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []
        pending_tool_call: list[ToolCall | None] = [None]

        func_body = ToolCall.FunctionBody(name='test_tool', arguments='{"arg1": "value1"}')
        wire_msg = ToolCall(id='call_123', function=func_body)
        await _process_wire_message(wire_msg, response_chunks, mock_ws, pending_tool_call)

        assert mock_ws.send_json.call_count == 1
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'tool_call'
        assert call_args['tool_call_id'] == 'call_123'
        assert call_args['tool_name'] == 'test_tool'
        assert call_args['arguments_raw'] == '{"arg1": "value1"}'

        await _flush_pending_tool_call(pending_tool_call, mock_ws)
        assert mock_ws.send_json.call_count == 2
        complete_args = mock_ws.send_json.call_args_list[1][0][0]
        assert complete_args['type'] == 'tool_call_complete'
        assert complete_args['tool_call_id'] == 'call_123'
        assert complete_args['tool_name'] == 'test_tool'
        assert complete_args['arguments'] == {'arg1': 'value1'}

    @pytest.mark.anyio
    async def test_process_tool_call_stream_then_complete(self) -> None:
        """ToolCall + ToolCallPart streams arguments_raw/chunks, flush sends complete."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []
        pending_tool_call: list[ToolCall | None] = [None]

        await _process_wire_message(
            ToolCall(
                id='call_1', function=ToolCall.FunctionBody(name='run', arguments='{"cmd": "')
            ),
            response_chunks,
            mock_ws,
            pending_tool_call,
        )
        assert mock_ws.send_json.call_count == 1
        assert mock_ws.send_json.call_args[0][0]['type'] == 'tool_call'
        assert mock_ws.send_json.call_args[0][0]['arguments_raw'] == '{"cmd": "'

        await _process_wire_message(
            ToolCallPart(arguments_part='ls"}'),
            response_chunks,
            mock_ws,
            pending_tool_call,
        )
        assert mock_ws.send_json.call_count == 2
        assert mock_ws.send_json.call_args[0][0]['type'] == 'tool_call_chunk'
        assert mock_ws.send_json.call_args[0][0]['content'] == 'ls"}'

        await _flush_pending_tool_call(pending_tool_call, mock_ws)
        assert mock_ws.send_json.call_count == 3
        complete = mock_ws.send_json.call_args[0][0]
        assert complete['type'] == 'tool_call_complete'
        assert complete['arguments'] == {'cmd': 'ls'}

    @pytest.mark.anyio
    async def test_process_tool_result(self) -> None:
        """Test processing ToolResult message."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []
        pending_tool_call: list[ToolCall | None] = [None]

        return_value = ToolReturnValue(
            is_error=False,
            output='Result output',
            message='Success',
            display=[DisplayBlock(type='text')],
        )
        wire_msg = ToolResult(tool_call_id='call_123', return_value=return_value)
        await _process_wire_message(wire_msg, response_chunks, mock_ws, pending_tool_call)

        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'tool_result'
        assert call_args['tool_call_id'] == 'call_123'
        # Same as context: full message from tool_result_to_message (system(message) + output)
        assert '<system>Success</system>' in call_args['output']
        assert 'Result output' in call_args['output']

    @pytest.mark.anyio
    async def test_process_approval_request(self) -> None:
        """Test processing ApprovalRequest message."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []
        pending_tool_call: list[ToolCall | None] = [None]

        wire_msg = ApprovalRequest(
            id=str(uuid4()),
            tool_call_id='call_123',
            sender='assistant',
            action='test_action',
            description='Test description',
        )
        await _process_wire_message(wire_msg, response_chunks, mock_ws, pending_tool_call)

        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'approval'
        assert call_args['action'] == 'test_action'
        assert call_args['description'] == 'Test description'
