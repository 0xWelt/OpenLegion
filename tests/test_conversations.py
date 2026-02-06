"""Tests for conversations module."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest
from kosong.message import ContentPart, Message, TextPart, ThinkPart

from legion.conversations import (
    Conversation,
    ConversationManager,
    ConversationSchema,
    UIMessageAssistant,
    UIMessageToolResult,
    UIMessageUser,
    conversation_manager,
)


class TestConversation:
    """Tests for Conversation dataclass."""

    def test_to_dict(self) -> None:
        """Test conversion to dictionary."""
        conv = Conversation(
            id='test123',
            title='Test Conversation',
            session_id='legion-conv-test123',
            work_dir='/tmp/test',
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T01:00:00',
            message_count=5,
        )
        result = conv.to_dict()

        assert result['id'] == 'test123'
        assert result['title'] == 'Test Conversation'
        assert result['session_id'] == 'legion-conv-test123'
        assert result['work_dir'] == '/tmp/test'
        assert result['created_at'] == '2024-01-01T00:00:00'
        assert result['updated_at'] == '2024-01-01T01:00:00'
        assert result['message_count'] == 5

    def test_from_dict(self) -> None:
        """Test creation from dictionary."""
        data = ConversationSchema(
            id='test456',
            title='Another Test',
            session_id='legion-conv-test456',
            work_dir='/tmp/test2',
            created_at='2024-02-01T00:00:00',
            updated_at='2024-02-01T02:00:00',
            message_count=10,
        )
        conv = Conversation.from_schema(data)

        assert conv.id == 'test456'
        assert conv.title == 'Another Test'
        assert conv.session_id == 'legion-conv-test456'
        assert conv.work_dir == '/tmp/test2'
        assert conv.created_at == '2024-02-01T00:00:00'
        assert conv.updated_at == '2024-02-01T02:00:00'
        assert conv.message_count == 10

    def test_from_dict_default_message_count(self) -> None:
        """Test that message_count defaults to 0."""
        data = ConversationSchema(
            id='test789',
            title='Test',
            session_id='legion-conv-test789',
            work_dir='/tmp/test3',
            created_at='2024-03-01T00:00:00',
            updated_at='2024-03-01T03:00:00',
        )
        conv = Conversation.from_schema(data)

        assert conv.message_count == 0


@pytest.mark.anyio
class TestConversationManager:
    """Tests for ConversationManager."""

    @pytest.fixture(autouse=True)
    def setup_manager(self, tmp_path: Path):
        """Set up a fresh manager for each test."""
        self.temp_dir = tmp_path
        self.conv_file = tmp_path / 'conversations.json'

        with patch('legion.conversations.CONVERSATIONS_FILE', self.conv_file):
            self.manager = ConversationManager()
            self.manager._conversations.clear()
            yield

    @pytest.mark.anyio
    async def test_create_conversation(self) -> None:
        """Test creating a new conversation."""
        with patch('legion.conversations.Path.home', return_value=self.temp_dir):
            conv = await self.manager.create_conversation(title='Test Chat')

        assert conv.title == 'Test Chat'
        assert len(conv.id) == 8
        assert conv.session_id.startswith('legion-conv-')
        assert conv.message_count == 0

    @pytest.mark.anyio
    async def test_create_conversation_with_work_dir(self) -> None:
        """Test creating conversation with custom work directory."""
        custom_dir = str(self.temp_dir / 'custom_work')

        conv = await self.manager.create_conversation(title='Custom Dir Chat', work_dir=custom_dir)

        assert conv.work_dir == custom_dir
        assert Path(custom_dir).exists()

    @pytest.mark.anyio
    async def test_get_conversation(self) -> None:
        """Test getting a conversation by ID."""
        with patch('legion.conversations.Path.home', return_value=self.temp_dir):
            conv = await self.manager.create_conversation(title='Test')

        result = await self.manager.get_conversation(conv.id)

        assert result is not None
        assert result.id == conv.id
        assert result.title == 'Test'

    @pytest.mark.anyio
    async def test_get_conversation_not_found(self) -> None:
        """Test getting non-existent conversation."""
        result = await self.manager.get_conversation('nonexistent')

        assert result is None

    @pytest.mark.anyio
    async def test_list_conversations(self) -> None:
        """Test listing all conversations."""
        with patch('legion.conversations.Path.home', return_value=self.temp_dir):
            conv1 = await self.manager.create_conversation(title='First')
            conv2 = await self.manager.create_conversation(title='Second')

        conversations = await self.manager.list_conversations()

        assert len(conversations) == 2
        # Should be sorted by updated_at desc
        assert conversations[0].id == conv2.id
        assert conversations[1].id == conv1.id

    @pytest.mark.anyio
    async def test_delete_conversation(self) -> None:
        """Test deleting a conversation."""
        with patch('legion.conversations.Path.home', return_value=self.temp_dir):
            conv = await self.manager.create_conversation(title='To Delete')

        result = await self.manager.delete_conversation(conv.id)

        assert result is True
        assert await self.manager.get_conversation(conv.id) is None

    @pytest.mark.anyio
    async def test_delete_conversation_not_found(self) -> None:
        """Test deleting non-existent conversation."""
        result = await self.manager.delete_conversation('nonexistent')

        assert result is False

    @pytest.mark.anyio
    async def test_update_conversation(self) -> None:
        """Test updating conversation metadata."""
        with patch('legion.conversations.Path.home', return_value=self.temp_dir):
            conv = await self.manager.create_conversation(title='Original')

        updated = await self.manager.update_conversation(conv.id, title='Updated', message_count=5)

        assert updated is not None
        assert updated.title == 'Updated'
        assert updated.message_count == 5

    @pytest.mark.anyio
    async def test_update_conversation_not_found(self) -> None:
        """Test updating non-existent conversation."""
        result = await self.manager.update_conversation('nonexistent', title='Test')

        assert result is None

    @pytest.mark.anyio
    async def test_persistence(self) -> None:
        """Test that conversations are persisted to disk."""
        with patch('legion.conversations.Path.home', return_value=self.temp_dir):
            conv = await self.manager.create_conversation(title='Persistent')

        # Create new manager instance (simulating restart)
        new_manager = ConversationManager()

        loaded = await new_manager.get_conversation(conv.id)

        assert loaded is not None
        assert loaded.title == 'Persistent'


class TestConversationHistory:
    """Tests for conversation history loading."""

    @pytest.fixture(autouse=True)
    def setup_manager(self, tmp_path: Path):
        """Set up a fresh manager for each test."""
        self.temp_dir = tmp_path
        self.conv_file = tmp_path / 'conversations.json'

        with patch('legion.conversations.CONVERSATIONS_FILE', self.conv_file):
            self.manager = ConversationManager()
            self.manager._conversations.clear()
            yield

    def test_extract_text_from_content_string(self) -> None:
        """Test extracting text from string content."""
        result = self.manager._extract_text_from_content('Hello world')

        assert result == 'Hello world'

    def test_extract_text_from_content_list(self) -> None:
        """Test extracting text from list of parts."""
        content: list[ContentPart] = [
            TextPart(text='Hello'),
            TextPart(text='world'),
        ]
        result = self.manager._extract_text_from_content(content)

        assert result == 'Hello world'

    def test_extract_text_thinking_and_tool_calls(self) -> None:
        """Test extracting text, thinking and tool calls."""
        content: list[ContentPart] = [
            TextPart(text='Answer'),
            ThinkPart(think='Let me think'),
        ]
        text, thinking, tool_calls = self.manager._extract_text_thinking_and_tool_calls(content)

        assert text == 'Answer'
        assert thinking == 'Let me think'
        assert tool_calls == []

    def test_process_context_record_user(self) -> None:
        """Test processing user context record."""
        data = Message.model_validate(
            {
                'role': 'user',
                'content': [{'type': 'text', 'text': 'Hello'}],
            }
        )
        result = self.manager._process_context_record(data)

        assert isinstance(result, UIMessageUser)
        assert result.content == 'Hello'

    def test_process_context_record_assistant(self) -> None:
        """Test processing assistant context record."""
        data = Message.model_validate(
            {
                'role': 'assistant',
                'content': [
                    {'type': 'text', 'text': 'Hi'},
                    {'type': 'think', 'think': 'Thinking...'},
                ],
            }
        )
        result = self.manager._process_context_record(data)

        assert isinstance(result, UIMessageAssistant)
        assert result.content == 'Hi'
        assert result.thinking == 'Thinking...'

    def test_process_context_record_tool(self) -> None:
        """Test processing tool context record."""
        data = Message.model_validate(
            {
                'role': 'tool',
                'content': 'Result',
                'tool_call_id': 'call_123',
            }
        )
        result = self.manager._process_context_record(data)

        assert isinstance(result, UIMessageToolResult)
        assert result.tool_call_id == 'call_123'
        assert result.output == 'Result'

    def test_process_context_record_assistant_with_tool_calls(self) -> None:
        """Test processing assistant record with tool_calls field."""
        data = Message.model_validate(
            {
                'role': 'assistant',
                'content': [{'type': 'think', 'think': 'Let me use Shell tool'}],
                'tool_calls': [
                    {
                        'type': 'function',
                        'id': 'Shell:0',
                        'function': {
                            'name': 'Shell',
                            'arguments': '{"command": "ls -la"}',
                        },
                    }
                ],
            }
        )
        result = self.manager._process_context_record(data)

        assert isinstance(result, UIMessageAssistant)
        assert result.thinking == 'Let me use Shell tool'
        assert len(result.tool_calls) == 1
        assert result.tool_calls[0].tool_name == 'Shell'
        assert result.tool_calls[0].arguments == {'command': 'ls -la'}
        assert result.tool_calls[0].tool_call_id == 'Shell:0'

    def test_process_context_record_tool_with_list_content(self) -> None:
        """Test processing tool record with list content (text parts)."""
        data = Message.model_validate(
            {
                'role': 'tool',
                'content': [
                    {'type': 'text', 'text': '<system>Command executed successfully.</system>'},
                    {'type': 'text', 'text': 'total 0\n'},
                ],
                'tool_call_id': 'Shell:0',
            }
        )
        result = self.manager._process_context_record(data)

        assert isinstance(result, UIMessageToolResult)
        assert result.tool_call_id == 'Shell:0'
        assert '<system>Command executed successfully.</system>' in result.output
        assert 'total 0' in result.output

    def test_process_context_record_internal(self) -> None:
        """Test that non-user/assistant/tool roles (e.g. system) are skipped."""
        data = Message(role='system', content=[])
        result = self.manager._process_context_record(data)

        assert result is None


@pytest.mark.anyio
async def test_get_conversation_history_includes_tool_and_tool_result(
    tmp_path: Path,
) -> None:
    """Load history from context.jsonl returns user, assistant with tool_calls, and tool_result."""
    conv_file = tmp_path / 'conversations.json'
    conv_file.write_text('{"conversations":[]}')
    context_path = tmp_path / 'context.jsonl'
    lines = [
        '{"role":"user","content":"Run pwd"}',
        '{"role":"assistant","content":[{"type":"think","think":"I will run pwd"}],"tool_calls":[{"type":"function","id":"Shell:0","function":{"name":"Shell","arguments":"{\\"command\\":\\"pwd\\"}"}}]}',
        '{"role":"tool","content":"/Users/dh/.legion/workdirs/abc","tool_call_id":"Shell:0"}',
    ]
    context_path.write_text('\n'.join(lines))

    with patch('legion.conversations.CONVERSATIONS_FILE', conv_file):
        manager = ConversationManager()
        manager._conversations.clear()
        conv = Conversation(
            id='hist1',
            title='History',
            session_id='legion-conv-hist1',
            work_dir=str(tmp_path),
            created_at='2024-01-01T00:00:00',
            updated_at='2024-01-01T01:00:00',
            message_count=3,
        )
        manager._conversations[conv.id] = conv

        def return_context_path(c: Conversation) -> Path | None:
            if c.id == conv.id:
                return context_path
            return None

        with patch.object(
            ConversationManager,
            '_get_context_file_path',
            side_effect=return_context_path,
        ):
            messages = await manager.get_conversation_history(conv.id)

    assert len(messages) == 3
    assert isinstance(messages[0], UIMessageUser)
    assert messages[0].content == 'Run pwd'
    assert isinstance(messages[1], UIMessageAssistant)
    assert messages[1].tool_calls
    assert messages[1].tool_calls[0].tool_name == 'Shell'
    assert messages[1].tool_calls[0].arguments == {'command': 'pwd'}
    assert messages[1].tool_calls[0].tool_call_id == 'Shell:0'
    assert isinstance(messages[2], UIMessageToolResult)
    assert messages[2].tool_call_id == 'Shell:0'
    assert '/Users/dh/.legion/workdirs/abc' in messages[2].output


class TestGlobalConversationManager:
    """Tests for the global conversation_manager instance."""

    def test_global_instance_exists(self) -> None:
        """Test that global instance exists."""
        assert conversation_manager is not None
        assert isinstance(conversation_manager, ConversationManager)
