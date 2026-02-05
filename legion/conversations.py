"""Multi-conversation management for Legion chat."""

from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import aiofiles
from kaos.path import KaosPath
from kimi_agent_sdk import Session
from kimi_cli.metadata import load_metadata
from loguru import logger


CONVERSATIONS_FILE = Path.home() / '.legion' / 'conversations.json'


@dataclass
class Conversation:
    """Represents a single conversation."""

    id: str
    title: str
    session_id: str
    work_dir: str
    created_at: str
    updated_at: str
    message_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'title': self.title,
            'session_id': self.session_id,
            'work_dir': self.work_dir,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'message_count': self.message_count,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Conversation:
        return cls(
            id=data['id'],
            title=data['title'],
            session_id=data['session_id'],
            work_dir=data['work_dir'],
            created_at=data['created_at'],
            updated_at=data['updated_at'],
            message_count=data.get('message_count', 0),
        )


class ConversationManager:
    """Manages multiple conversations with session persistence."""

    def __init__(self) -> None:
        self._conversations: dict[str, Conversation] = {}
        self._sessions: dict[str, Session] = {}
        self._lock = asyncio.Lock()
        self._ensure_storage()
        self._load_conversations()

    def _ensure_storage(self) -> None:
        """Ensure storage directory exists."""
        CONVERSATIONS_FILE.parent.mkdir(parents=True, exist_ok=True)

    def _load_conversations(self) -> None:
        """Load conversations from disk."""
        if not CONVERSATIONS_FILE.exists():
            return
        try:
            data = json.loads(CONVERSATIONS_FILE.read_text())
            for conv_data in data.get('conversations', []):
                conv = Conversation.from_dict(conv_data)
                self._conversations[conv.id] = conv
        except (json.JSONDecodeError, KeyError):
            pass

    def _save_conversations(self) -> None:
        """Save conversations to disk."""
        data = {
            'conversations': [conv.to_dict() for conv in self._conversations.values()],
        }
        CONVERSATIONS_FILE.write_text(json.dumps(data, indent=2))

    async def create_conversation(
        self,
        title: str = 'New Conversation',
        work_dir: str | None = None,
    ) -> Conversation:
        """Create a new conversation with a fresh session."""
        conv_id = str(uuid.uuid4())[:8]
        session_id = f'legion-conv-{conv_id}'
        work_dir_path = work_dir or str(Path.home() / '.legion' / 'workdirs' / conv_id)
        Path(work_dir_path).mkdir(parents=True, exist_ok=True)

        now = datetime.now(tz=UTC).isoformat()
        conversation = Conversation(
            id=conv_id,
            title=title,
            session_id=session_id,
            work_dir=work_dir_path,
            created_at=now,
            updated_at=now,
        )

        async with self._lock:
            self._conversations[conversation.id] = conversation
            self._save_conversations()

        return conversation

    async def get_conversation(self, conv_id: str) -> Conversation | None:
        """Get a conversation by ID."""
        return self._conversations.get(conv_id)

    async def list_conversations(self) -> list[Conversation]:
        """List all conversations, sorted by updated_at desc."""
        return sorted(
            self._conversations.values(),
            key=lambda c: c.updated_at,
            reverse=True,
        )

    async def delete_conversation(self, conv_id: str) -> bool:
        """Delete a conversation and its session."""
        async with self._lock:
            conv = self._conversations.pop(conv_id, None)
            if conv is None:
                return False

            # Close and remove session if active
            session = self._sessions.pop(conv_id, None)
            if session:
                await session.close()

            self._save_conversations()
            return True

    async def update_conversation(
        self,
        conv_id: str,
        title: str | None = None,
        message_count: int | None = None,
    ) -> Conversation | None:
        """Update conversation metadata."""
        async with self._lock:
            conv = self._conversations.get(conv_id)
            if conv is None:
                return None

            if title is not None:
                conv.title = title
            if message_count is not None:
                conv.message_count = message_count
            conv.updated_at = datetime.now(tz=UTC).isoformat()

            self._save_conversations()
            return conv

    async def get_or_create_session(
        self,
        conv_id: str,
        yolo: bool = True,
    ) -> Session | None:
        """Get or resume a session for a conversation."""
        conv = await self.get_conversation(conv_id)
        if conv is None:
            return None

        # Return cached session if available
        if conv_id in self._sessions:
            return self._sessions[conv_id]

        # Ensure work_dir exists
        work_dir_path = Path(conv.work_dir)
        work_dir_path.mkdir(parents=True, exist_ok=True)

        # Try to resume existing session
        work_dir = KaosPath(conv.work_dir)
        session = None
        try:
            session = await Session.resume(
                work_dir=work_dir,
                session_id=conv.session_id,
                yolo=yolo,
            )

            if session is None:
                # Create new session
                session = await Session.create(
                    work_dir=work_dir,
                    session_id=conv.session_id,
                    yolo=yolo,
                )
        except Exception:  # noqa: BLE001
            logger.exception('Failed to create/resume session for %s', conv_id)
            return None
        else:
            self._sessions[conv_id] = session
            return session

    async def close_session(self, conv_id: str) -> None:
        """Close a session but keep the conversation."""
        session = self._sessions.pop(conv_id, None)
        if session:
            await session.close()

    async def close_all(self) -> None:
        """Close all sessions."""
        for session in self._sessions.values():
            await session.close()
        self._sessions.clear()

    def _get_context_file_path(self, conv: Conversation) -> Path | None:
        """Get the path to the context.jsonl file for a conversation."""
        work_dir = KaosPath(conv.work_dir)
        metadata = load_metadata()
        work_dir_meta = metadata.get_work_dir_meta(work_dir)
        if work_dir_meta is None:
            return None
        context_file = work_dir_meta.sessions_dir / conv.session_id / 'context.jsonl'
        if context_file.exists():
            return context_file
        return None

    def _extract_text_from_content(self, content: str | list[Any]) -> str:
        """Extract text from content which may be a string or list of parts."""
        if isinstance(content, list):
            text_parts = [
                part.get('text', '')
                for part in content
                if isinstance(part, dict) and part.get('type') == 'text'
            ]
            return ' '.join(text_parts)
        return str(content)

    def _extract_text_and_thinking(self, content: str | list[Any]) -> tuple[str, str]:
        """Extract text and thinking from assistant content."""
        if isinstance(content, list):
            text_parts = []
            thinking_parts = []
            for part in content:
                if not isinstance(part, dict):
                    continue
                part_type = part.get('type')
                if part_type == 'text':
                    text_parts.append(part.get('text', ''))
                elif part_type == 'thinking':
                    thinking_parts.append(part.get('thinking', ''))
            return ' '.join(text_parts), ' '.join(thinking_parts)
        return str(content), ''

    def _process_context_record(self, data: dict[str, Any]) -> dict[str, Any] | None:
        """Process a single context record and return a UI message or None."""
        role = data.get('role')

        # Skip internal records
        if role in ('_checkpoint', '_usage'):
            return None

        if role == 'user':
            content = data.get('content', '')
            return {
                'type': 'user',
                'content': self._extract_text_from_content(content),
            }

        if role == 'assistant':
            content = data.get('content', '')
            text, thinking = self._extract_text_and_thinking(content)
            return {
                'type': 'assistant',
                'content': text,
                'thinking': thinking,
            }

        if role == 'tool':
            content = data.get('content', '')
            return {
                'type': 'tool_result',
                'tool_call_id': data.get('tool_call_id', ''),
                'output': str(content) if content else '',
            }

        return None

    async def get_conversation_history(self, conv_id: str) -> list[dict[str, Any]]:
        """Load conversation history from context.jsonl file.

        Returns a list of UI-friendly message objects.
        """
        conv = await self.get_conversation(conv_id)
        if conv is None:
            return []

        context_file = self._get_context_file_path(conv)
        if context_file is None:
            return []

        messages: list[dict[str, Any]] = []

        try:
            async with aiofiles.open(context_file, encoding='utf-8') as f:
                async for line in f:
                    if not line.strip():
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    msg = self._process_context_record(data)
                    if msg is not None:
                        messages.append(msg)
        except OSError:
            logger.exception('Failed to load history for %s', conv_id)

        return messages


# Global conversation manager instance
conversation_manager = ConversationManager()
