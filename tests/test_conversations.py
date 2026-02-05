"""Tests for conversations module."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from legion.conversations import Conversation, ConversationManager, conversation_manager


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
        data: dict[str, Any] = {
            'id': 'test456',
            'title': 'Another Test',
            'session_id': 'legion-conv-test456',
            'work_dir': '/tmp/test2',
            'created_at': '2024-02-01T00:00:00',
            'updated_at': '2024-02-01T02:00:00',
            'message_count': 10,
        }
        conv = Conversation.from_dict(data)

        assert conv.id == 'test456'
        assert conv.title == 'Another Test'
        assert conv.session_id == 'legion-conv-test456'
        assert conv.work_dir == '/tmp/test2'
        assert conv.created_at == '2024-02-01T00:00:00'
        assert conv.updated_at == '2024-02-01T02:00:00'
        assert conv.message_count == 10

    def test_from_dict_default_message_count(self) -> None:
        """Test that message_count defaults to 0."""
        data: dict[str, Any] = {
            'id': 'test789',
            'title': 'Test',
            'session_id': 'legion-conv-test789',
            'work_dir': '/tmp/test3',
            'created_at': '2024-03-01T00:00:00',
            'updated_at': '2024-03-01T03:00:00',
        }
        conv = Conversation.from_dict(data)

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
        content = [
            {'type': 'text', 'text': 'Hello'},
            {'type': 'text', 'text': 'world'},
        ]
        result = self.manager._extract_text_from_content(content)

        assert result == 'Hello world'

    def test_extract_text_and_thinking(self) -> None:
        """Test extracting both text and thinking."""
        content = [
            {'type': 'text', 'text': 'Answer'},
            {'type': 'thinking', 'thinking': 'Let me think'},
        ]
        text, thinking = self.manager._extract_text_and_thinking(content)

        assert text == 'Answer'
        assert thinking == 'Let me think'

    def test_process_context_record_user(self) -> None:
        """Test processing user context record."""
        data = {'role': 'user', 'content': [{'type': 'text', 'text': 'Hello'}]}
        result = self.manager._process_context_record(data)

        assert result == {'type': 'user', 'content': 'Hello'}

    def test_process_context_record_assistant(self) -> None:
        """Test processing assistant context record."""
        data: dict[str, Any] = {
            'role': 'assistant',
            'content': [
                {'type': 'text', 'text': 'Hi'},
                {'type': 'thinking', 'thinking': 'Thinking...'},
            ],
        }
        result = self.manager._process_context_record(data)

        assert result is not None
        assert result['type'] == 'assistant'  # type: ignore[index]
        assert result['content'] == 'Hi'  # type: ignore[index]
        assert result['thinking'] == 'Thinking...'  # type: ignore[index]

    def test_process_context_record_tool(self) -> None:
        """Test processing tool context record."""
        data: dict[str, Any] = {
            'role': 'tool',
            'content': 'Result',
            'tool_call_id': 'call_123',
        }
        result = self.manager._process_context_record(data)

        assert result is not None
        assert result['type'] == 'tool_result'  # type: ignore[index]
        assert result['tool_call_id'] == 'call_123'  # type: ignore[index]
        assert result['output'] == 'Result'  # type: ignore[index]

    def test_process_context_record_internal(self) -> None:
        """Test that internal records are skipped."""
        data: dict[str, Any] = {'role': '_checkpoint', 'data': 'some_data'}
        result = self.manager._process_context_record(data)

        assert result is None


class TestGlobalConversationManager:
    """Tests for the global conversation_manager instance."""

    def test_global_instance_exists(self) -> None:
        """Test that global instance exists."""
        assert conversation_manager is not None
        assert isinstance(conversation_manager, ConversationManager)
