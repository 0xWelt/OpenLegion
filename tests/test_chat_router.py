"""Tests for chat_router module."""

from __future__ import annotations

import os
import tempfile
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from kimi_agent_sdk import ApprovalRequest, ToolResult
from kosong.message import TextPart, ThinkPart, ToolCall
from kosong.tooling import DisplayBlock, ToolReturnValue

from legion.chat_router import _process_wire_message
from legion.conversations import Conversation
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
            {'type': 'user', 'content': 'Hello'},
            {'type': 'assistant', 'content': 'Hi there'},
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


class TestProcessWireMessage:
    """Tests for _process_wire_message helper function."""

    @pytest.mark.anyio
    async def test_process_text_part(self) -> None:
        """Test processing TextPart message."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []

        wire_msg = TextPart(text='Hello world')
        await _process_wire_message(wire_msg, response_chunks, mock_ws)

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

        wire_msg = ThinkPart(think='Thinking about this...')
        await _process_wire_message(wire_msg, response_chunks, mock_ws)

        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'thinking'
        assert call_args['content'] == 'Thinking about this...'

    @pytest.mark.anyio
    async def test_process_tool_call(self) -> None:
        """Test processing ToolCall message."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []

        func_body = ToolCall.FunctionBody(name='test_tool', arguments='{"arg1": "value1"}')
        wire_msg = ToolCall(id='call_123', function=func_body)
        await _process_wire_message(wire_msg, response_chunks, mock_ws)

        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'tool_call'
        assert call_args['tool_name'] == 'test_tool'
        # arguments is returned as a string (JSON)
        assert '"arg1"' in call_args['arguments']

    @pytest.mark.anyio
    async def test_process_tool_result(self) -> None:
        """Test processing ToolResult message."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []

        return_value = ToolReturnValue(
            is_error=False,
            output='Result output',
            message='Success',
            display=[DisplayBlock(type='text')],
        )
        wire_msg = ToolResult(tool_call_id='call_123', return_value=return_value)
        await _process_wire_message(wire_msg, response_chunks, mock_ws)

        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'tool_result'
        assert call_args['tool_call_id'] == 'call_123'

    @pytest.mark.anyio
    async def test_process_approval_request(self) -> None:
        """Test processing ApprovalRequest message."""
        mock_ws = AsyncMock()
        response_chunks: list[str] = []

        wire_msg = ApprovalRequest(
            id=str(uuid4()),
            tool_call_id='call_123',
            sender='assistant',
            action='test_action',
            description='Test description',
        )
        await _process_wire_message(wire_msg, response_chunks, mock_ws)

        mock_ws.send_json.assert_called_once()
        call_args = mock_ws.send_json.call_args[0][0]
        assert call_args['type'] == 'approval'
        assert call_args['action'] == 'test_action'
        assert call_args['description'] == 'Test description'
