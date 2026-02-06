"""Multi-conversation management for Legion chat."""

from __future__ import annotations

import asyncio
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import md5
from pathlib import Path
from typing import Any, Literal, TypeGuard

import aiofiles
from kaos import get_current_kaos
from kaos.local import local_kaos
from kaos.path import KaosPath
from kimi_agent_sdk import Session
from kimi_cli.metadata import load_metadata
from kimi_cli.share import get_share_dir
from kosong.message import (
    ContentPart,
    Message,
    TextPart,
    ThinkPart,
    ToolCall,
    ToolCallPart,
)
from loguru import logger
from pydantic import BaseModel


CONVERSATIONS_FILE = Path.home() / '.legion' / 'conversations.json'

# Internal roles in context.jsonl that we skip when loading history
_CONTEXT_SKIP_ROLES = ('_checkpoint', '_usage')


def _preprocess_legacy_content(raw: dict[str, Any]) -> dict[str, Any]:
    """Convert legacy 'thinking' content parts to kosong 'think' before Message validation."""
    content = raw.get('content')
    if not isinstance(content, list):
        return raw
    out: list[dict[str, Any] | ContentPart] = []
    for item in content:
        if isinstance(item, dict) and item.get('type') == 'thinking':
            out.append({'type': 'think', 'think': str(item.get('thinking', ''))})
        else:
            out.append(item)
    return {**raw, 'content': out}


class ConversationSchema(BaseModel):
    """Serialized conversation (for validation and JSON)."""

    id: str
    """Conversation ID."""
    title: str
    """Conversation title."""
    session_id: str
    """Session ID."""
    work_dir: str
    """Working directory path."""
    created_at: str
    """ISO format creation time."""
    updated_at: str
    """ISO format last update time."""
    message_count: int = 0
    """Number of messages (default 0)."""


class UIMessageUser(BaseModel):
    """UI message for a user message."""

    type: Literal['user'] = 'user'
    """Literal 'user'."""
    content: str
    """Message text."""


class ToolCallInfo(BaseModel):
    """Tool call information."""

    tool_name: str
    """Name of the tool."""
    arguments: dict[str, Any] | str
    """Tool arguments."""
    tool_call_id: str = ''
    """ID linking this call to its tool result (e.g. Shell:0)."""


class UIMessageAssistant(BaseModel):
    """UI message for an assistant message."""

    type: Literal['assistant'] = 'assistant'
    """Literal 'assistant'."""
    content: str
    """Message text."""
    thinking: str
    """Thinking block content."""
    tool_calls: list[ToolCallInfo] = []
    """Tool calls made by assistant."""


class UIMessageToolResult(BaseModel):
    """UI message for a tool result."""

    type: Literal['tool_result'] = 'tool_result'
    """Literal 'tool_result'."""
    tool_call_id: str
    """ID of the tool call."""
    output: str
    """Tool output text."""


UIMessage = UIMessageUser | UIMessageAssistant | UIMessageToolResult


def _is_conversation_dict(obj: Any) -> TypeGuard[dict[str, Any]]:
    """Type guard for dict loaded from JSON that has conversation shape."""
    return isinstance(obj, dict) and all(
        k in obj for k in ('id', 'title', 'session_id', 'work_dir', 'created_at', 'updated_at')
    )


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
        return ConversationSchema(
            id=self.id,
            title=self.title,
            session_id=self.session_id,
            work_dir=self.work_dir,
            created_at=self.created_at,
            updated_at=self.updated_at,
            message_count=self.message_count,
        ).model_dump()

    @classmethod
    def from_schema(cls, schema: ConversationSchema) -> Conversation:
        return cls(
            id=schema.id,
            title=schema.title,
            session_id=schema.session_id,
            work_dir=schema.work_dir,
            created_at=schema.created_at,
            updated_at=schema.updated_at,
            message_count=schema.message_count,
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Conversation:
        return cls.from_schema(ConversationSchema.model_validate(data))


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
        data = json.loads(CONVERSATIONS_FILE.read_text())
        for conv_data in data.get('conversations', []):
            if _is_conversation_dict(conv_data):
                conv = Conversation.from_schema(ConversationSchema.model_validate(conv_data))
                self._conversations[conv.id] = conv

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
        thinking: bool = False,
        model: str | None = None,
    ) -> Session | None:
        """Get or resume a session for a conversation."""
        conv = await self.get_conversation(conv_id)
        if conv is None:
            return None

        # Check cached session - may need to recreate if params changed
        cached = self._sessions.get(conv_id)
        if cached is not None:
            # Check if model/thinking params match
            current_model = getattr(cached, 'model_name', None)
            if current_model == model:
                return cached
            # Params don't match, close and recreate
            await cached.close()
            del self._sessions[conv_id]

        # Ensure work_dir exists
        work_dir_path = Path(conv.work_dir)
        work_dir_path.mkdir(parents=True, exist_ok=True)

        # Build kwargs for session creation
        session_kwargs: dict[str, Any] = {'yolo': yolo}
        if thinking:
            session_kwargs['thinking'] = thinking
        if model:
            session_kwargs['model'] = model

        # Try to resume existing session
        work_dir = KaosPath(conv.work_dir)
        session = None
        try:
            session = await Session.resume(
                work_dir=work_dir,
                session_id=conv.session_id,
                **session_kwargs,
            )

            if session is None:
                # Create new session
                session = await Session.create(
                    work_dir=work_dir,
                    session_id=conv.session_id,
                    **session_kwargs,
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
        """Get the path to the context.jsonl file for a conversation.

        Uses metadata when available; falls back to same path formula as kimi-cli
        (get_share_dir() / "sessions" / <md5(work_dir)> / session_id / context.jsonl)
        so history loads even if metadata was cleared or path was stored in canonical form.
        """
        work_dir = KaosPath(conv.work_dir).canonical()
        metadata = load_metadata()
        work_dir_meta = metadata.get_work_dir_meta(work_dir)
        if work_dir_meta is not None:
            context_file = work_dir_meta.sessions_dir / conv.session_id / 'context.jsonl'
            if context_file.exists():
                return context_file
        # Fallback: compute sessions dir same as kimi_cli.metadata.WorkDirMeta.sessions_dir
        path_str = str(work_dir)
        path_md5 = md5(path_str.encode(encoding='utf-8')).hexdigest()
        kaos_name = get_current_kaos().name
        dir_basename = path_md5 if kaos_name == local_kaos.name else f'{kaos_name}_{path_md5}'
        fallback_dir = get_share_dir() / 'sessions' / dir_basename
        context_file = fallback_dir / conv.session_id / 'context.jsonl'
        if context_file.exists():
            return context_file
        return None

    def _extract_text_from_content(self, content: str | list[ContentPart]) -> str:
        """Extract text from content which may be a string or list of content parts."""
        if isinstance(content, list):
            text_parts = [part.text for part in content if isinstance(part, TextPart)]
            return ' '.join(text_parts)
        return str(content)

    def _extract_text_thinking_and_tool_calls(
        self, content: str | list[ContentPart]
    ) -> tuple[str, str, list[ToolCallInfo]]:
        """Extract text, thinking and tool calls from assistant content."""
        if isinstance(content, list):
            text_parts = [part.text for part in content if isinstance(part, TextPart)]
            thinking_parts = [part.think for part in content if isinstance(part, ThinkPart)]
            tool_calls = [
                ToolCallInfo(
                    tool_name=part.function.name if hasattr(part.function, 'name') else 'unknown',
                    arguments=part.function.arguments
                    if hasattr(part.function, 'arguments') and part.function.arguments is not None
                    else {},
                    tool_call_id=getattr(part, 'id', None) or '',
                )
                for part in content
                if isinstance(part, ToolCall)
            ]
            # Also handle ToolCallPart (streaming tool call arguments)
            for part in content:
                if isinstance(part, ToolCallPart) and part.arguments_part:
                    args = json.loads(part.arguments_part)
                    tool_calls.append(ToolCallInfo(tool_name='unknown', arguments=args))
            return ' '.join(text_parts), ' '.join(thinking_parts), tool_calls
        return str(content), '', []

    def _process_context_record(self, data: Message) -> UIMessage | None:
        """Process a single context message (kosong Message) and return a UI message or None."""
        role = data.role
        if role == 'user':
            return UIMessageUser(content=self._extract_text_from_content(data.content))
        if role == 'assistant':
            return self._process_assistant_record(data)
        if role == 'tool':
            return self._process_tool_record(data)
        # system or other
        return None

    def _process_assistant_record(self, data: Message) -> UIMessageAssistant:
        """Process an assistant message and return a UI message."""
        text, thinking, tool_calls = self._extract_text_thinking_and_tool_calls(data.content)
        for tc in data.tool_calls or []:
            args: dict[str, Any] | str = tc.function.arguments or '{}'
            if isinstance(args, str):
                args = json.loads(args)
            tool_calls.append(
                ToolCallInfo(
                    tool_name=tc.function.name,
                    arguments=args,
                    tool_call_id=getattr(tc, 'id', None) or '',
                )
            )
        return UIMessageAssistant(content=text, thinking=thinking, tool_calls=tool_calls)

    def _process_tool_record(self, data: Message) -> UIMessageToolResult:
        """Process a tool message and return a UI message."""
        output_parts = [
            part.text if isinstance(part, TextPart) else str(part) for part in data.content
        ]
        output = '\n'.join(output_parts)
        return UIMessageToolResult(
            tool_call_id=str(data.tool_call_id or ''),
            output=output,
        )

    async def get_conversation_history(self, conv_id: str) -> list[UIMessage]:
        """Load conversation history from context.jsonl file.

        Returns a list of UI-friendly message objects.
        """
        conv = await self.get_conversation(conv_id)
        if conv is None:
            return []

        context_file = self._get_context_file_path(conv)
        if context_file is None:
            return []

        messages: list[UIMessage] = []

        async with aiofiles.open(context_file, encoding='utf-8') as f:
            async for line in f:
                if not line.strip():
                    continue
                raw = json.loads(line)
                if raw.get('role') in _CONTEXT_SKIP_ROLES:
                    continue
                raw = _preprocess_legacy_content(raw)
                record = Message.model_validate(raw)
                msg = self._process_context_record(record)
                if msg is not None:
                    messages.append(msg)
        return messages


# Global conversation manager instance
conversation_manager = ConversationManager()
