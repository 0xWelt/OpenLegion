"""Chat API routes and WebSocket handler."""

from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path

import tomlkit
from fastapi import APIRouter, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from kimi_agent_sdk import ApprovalRequest, RunCancelled, ToolResult, WireMessage
from kimi_cli.soul.message import tool_result_to_message
from kimi_cli.wire.types import StatusUpdate
from kosong.message import ContentPart, ImageURLPart, TextPart, ThinkPart, ToolCall, ToolCallPart
from loguru import logger
from pydantic import BaseModel

from legion.conversations import (
    ConversationSchema,
    conversation_manager,
)


class ModelConfig(BaseModel, extra='allow'):
    """Single model entry under [models.<name>]."""

    provider: str
    """Provider key (e.g. kimi-internal, qianxun-kimi)."""
    model: str
    """Backend model identifier."""
    max_context_size: int = 0
    """Max context size."""
    capabilities: list[str] = []
    """Optional capabilities (e.g. image_in, thinking)."""


class ProviderConfig(BaseModel, extra='allow'):
    """Single provider entry under [providers.<name>]."""

    type: str
    """Provider type (e.g. kimi, openai_responses, anthropic, vertexai)."""
    base_url: str
    """API base URL."""
    api_key: str
    """API key."""


class KimiConfig(BaseModel, extra='allow'):
    """Kimi-cli config file shape."""

    default_model: str = 'kimi-k2-0711'
    """Default model name."""
    default_thinking: bool = False
    """Whether thinking mode is on by default."""
    models: dict[str, ModelConfig] = {}
    """Model name to config mapping."""
    providers: dict[str, ProviderConfig] = {}
    """Provider name to config mapping."""


def _convert_toml_table(obj: object) -> object:
    """Recursively convert tomlkit tables to plain dicts."""
    if isinstance(obj, dict):
        return {k: _convert_toml_table(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_toml_table(item) for item in obj]
    return obj


def _parse_models(raw: object) -> dict[str, ModelConfig]:
    """Build models dict from raw config; invalid entries raise."""
    if not isinstance(raw, dict):
        return {}
    result: dict[str, ModelConfig] = {}
    for name, val in raw.items():
        if not isinstance(val, dict):
            msg = f'Expected dict for model {name!r}, got {type(val).__name__}'
            raise TypeError(msg)
        result[str(name)] = ModelConfig.model_validate(val)
    return result


def _parse_providers(raw: object) -> dict[str, ProviderConfig]:
    """Build providers dict from raw config; invalid entries raise."""
    if not isinstance(raw, dict):
        return {}
    result: dict[str, ProviderConfig] = {}
    for name, val in raw.items():
        if not isinstance(val, dict):
            msg = f'Expected dict for provider {name!r}, got {type(val).__name__}'
            raise TypeError(msg)
        result[str(name)] = ProviderConfig.model_validate(val)
    return result


class ConfigResponse(BaseModel):
    """GET /config response."""

    config: KimiConfig
    """Kimi-cli configuration."""


class CreateConversationBody(BaseModel):
    """POST / conversation body."""

    title: str = 'New Conversation'
    """Conversation title."""
    work_dir: str | None = None
    """Working directory path (optional)."""


class CreateConversationResponse(BaseModel):
    """POST / response."""

    conversation: ConversationSchema
    """Created conversation schema."""


class ListConversationsResponse(BaseModel):
    """GET / response."""

    conversations: list[ConversationSchema]
    """List of conversation schemas."""


class UpdateConversationBody(BaseModel):
    """PATCH /:id body."""

    title: str | None = None
    """New title (optional)."""
    message_count: int | None = None
    """New message count (optional)."""


def load_kimi_config() -> KimiConfig:
    """Load kimi-cli config from ~/.kimi/config.toml."""
    config_path = Path.home() / '.kimi' / 'config.toml'
    default = KimiConfig()

    if not config_path.exists():
        json_config_path = Path.home() / '.kimi' / 'config.json'
        if json_config_path.exists():
            with open(json_config_path, encoding='utf-8') as f:
                legacy = json.load(f)
            return KimiConfig(
                default_model=legacy.get('default_model', default.default_model),
                default_thinking=legacy.get('default_thinking', default.default_thinking),
                models=_parse_models(legacy.get('models')),
                providers=_parse_providers(legacy.get('providers')),
            )
        return default

    with open(config_path, encoding='utf-8') as f:
        config = tomlkit.load(f)
    raw_models = _convert_toml_table(dict(config.get('models', {})))
    raw_providers = _convert_toml_table(dict(config.get('providers', {})))
    return KimiConfig(
        default_model=config.get('default_model', default.default_model),
        default_thinking=config.get('default_thinking', default.default_thinking),
        models=_parse_models(raw_models),
        providers=_parse_providers(raw_providers),
    )


router = APIRouter(prefix='/api/conversations', tags=['conversations'])


@router.get('/config')
async def get_config() -> ConfigResponse:
    """Get kimi-cli configuration."""
    config = load_kimi_config()
    return ConfigResponse(config=config)


@router.get('')
async def list_conversations() -> ListConversationsResponse:
    """List all conversations."""
    conversations = await conversation_manager.list_conversations()
    return ListConversationsResponse(
        conversations=[ConversationSchema.model_validate(c.to_dict()) for c in conversations]
    )


@router.post('')
async def create_conversation(data: CreateConversationBody) -> CreateConversationResponse:
    """Create a new conversation."""
    conv = await conversation_manager.create_conversation(data.title, data.work_dir)
    return CreateConversationResponse(
        conversation=ConversationSchema.model_validate(conv.to_dict())
    )


@router.get('/{conv_id}')
async def get_conversation(conv_id: str) -> Response:
    """Get a single conversation."""
    conv = await conversation_manager.get_conversation(conv_id)
    if conv is None:
        return JSONResponse(
            status_code=404,
            content={'error': 'Conversation not found'},
        )
    return JSONResponse({'conversation': conv.to_dict()})


@router.delete('/{conv_id}')
async def delete_conversation(conv_id: str) -> Response:
    """Delete a conversation."""
    success = await conversation_manager.delete_conversation(conv_id)
    if not success:
        return JSONResponse(
            status_code=404,
            content={'error': 'Conversation not found'},
        )
    return JSONResponse({'success': True})


@router.patch('/{conv_id}')
async def update_conversation(conv_id: str, data: UpdateConversationBody) -> Response:
    """Update conversation metadata."""
    conv = await conversation_manager.update_conversation(
        conv_id, title=data.title, message_count=data.message_count
    )
    if conv is None:
        return JSONResponse(
            status_code=404,
            content={'error': 'Conversation not found'},
        )
    return JSONResponse({'conversation': conv.to_dict()})


@router.get('/{conv_id}/history')
async def get_conversation_history(conv_id: str) -> Response:
    """Get conversation history (messages)."""
    conv = await conversation_manager.get_conversation(conv_id)
    if conv is None:
        return JSONResponse(
            status_code=404,
            content={'error': 'Conversation not found'},
        )

    messages = await conversation_manager.get_conversation_history(conv_id)
    return JSONResponse({'messages': [m.model_dump() for m in messages]})


@router.post('/{conv_id}/upload')
async def upload_file(conv_id: str, file: UploadFile) -> Response:
    """Upload a file to the conversation's work directory."""
    conv = await conversation_manager.get_conversation(conv_id)
    if conv is None:
        return JSONResponse(
            status_code=404,
            content={'error': 'Conversation not found'},
        )

    # Generate unique filename
    original_name = file.filename or 'unnamed'
    ext = Path(original_name).suffix
    unique_name = f'{uuid.uuid4().hex[:16]}{ext}'

    # Save to work_dir
    work_dir = Path(conv.work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)
    file_path = work_dir / unique_name

    try:
        with file_path.open('wb') as f:
            shutil.copyfileobj(file.file, f)
    except OSError as e:
        logger.exception('Failed to save uploaded file')
        return JSONResponse(
            status_code=500,
            content={'error': f'Failed to save file: {e}'},
        )
    finally:
        await file.close()

    # Return the file URL (relative to work_dir)
    return JSONResponse(
        {
            'url': str(file_path),
            'filename': original_name,
        }
    )


async def _flush_pending_tool_call(
    pending: list[ToolCall | None],
    websocket: WebSocket,
) -> None:
    """Parse accumulated arguments, send tool_call_complete, clear pending.

    Frontend uses this to replace the streaming string with parsed JSON in place.
    """
    call = pending[0]
    if call is None:
        return
    tool_call_id = getattr(call, 'id', None) or ''
    tool_name = call.function.name if hasattr(call.function, 'name') else 'unknown'
    args_str = call.function.arguments or ''
    arguments: dict[str, object] = {}
    if args_str.strip():
        try:
            arguments = json.loads(args_str)
        except json.JSONDecodeError:
            pass
    logger.debug(f'Tool call complete: {tool_name} {arguments}')
    await websocket.send_json(
        {
            'type': 'tool_call_complete',
            'tool_call_id': tool_call_id,
            'tool_name': tool_name,
            'arguments': arguments,
        }
    )
    pending[0] = None


async def _process_wire_message(
    wire_msg: WireMessage,
    response_chunks: list[str],
    websocket: WebSocket,
    pending_tool_call: list[ToolCall | None],
) -> None:
    """Process a single wire message and send appropriate response.

    ToolCallPart is merged into pending_tool_call (like kimi_agent_sdk._aggregator);
    we only parse arguments and send when we have the full string.
    """
    msg_type = type(wire_msg).__name__
    logger.debug(f'Processing wire message: {msg_type}')

    # Handle ContentPart subtypes (TextPart, ThinkPart, etc.)
    if isinstance(wire_msg, ContentPart):
        await _flush_pending_tool_call(pending_tool_call, websocket)
        if isinstance(wire_msg, TextPart) and wire_msg.text:
            response_chunks.append(wire_msg.text)
            logger.debug(f'Sending text chunk: {wire_msg.text[:50]}...')
            await websocket.send_json(
                {
                    'type': 'chunk',
                    'content': wire_msg.text,
                }
            )
        elif isinstance(wire_msg, ThinkPart) and wire_msg.think:
            logger.debug(f'Sending thinking: {wire_msg.think[:50]}...')
            await websocket.send_json(
                {
                    'type': 'think',
                    'content': wire_msg.think,
                }
            )
    elif isinstance(wire_msg, ToolCall):
        await _flush_pending_tool_call(pending_tool_call, websocket)
        pending_tool_call[0] = wire_msg
        # Stream start: frontend shows spinner + arguments_raw (string)
        tool_call_id = getattr(wire_msg, 'id', None) or ''
        tool_name = wire_msg.function.name if hasattr(wire_msg.function, 'name') else 'unknown'
        arguments_raw = wire_msg.function.arguments or ''
        await websocket.send_json(
            {
                'type': 'tool_call',
                'tool_call_id': tool_call_id,
                'tool_name': tool_name,
                'arguments_raw': arguments_raw,
            }
        )
    elif isinstance(wire_msg, ToolCallPart):
        if pending_tool_call[0] is not None:
            pending_tool_call[0].merge_in_place(wire_msg)
            # Stream chunk: frontend appends to string (like think)
            chunk = wire_msg.arguments_part or ''
            if chunk:
                tool_call_id = getattr(pending_tool_call[0], 'id', None) or ''
                await websocket.send_json(
                    {
                        'type': 'tool_call_chunk',
                        'tool_call_id': tool_call_id,
                        'content': chunk,
                    }
                )
    elif isinstance(wire_msg, ToolResult):
        await _flush_pending_tool_call(pending_tool_call, websocket)
        # Use same "full tool message" as context: tool_result_to_message builds role=tool Message
        # that kimi-cli appends to context; we serialize its content so frontend = what model sees
        msg = tool_result_to_message(wire_msg)
        output_parts = [
            part.text if isinstance(part, TextPart) else str(part) for part in msg.content
        ]
        output = '\n'.join(output_parts)
        logger.debug(f'Tool result: {output[:50]}...')
        await websocket.send_json(
            {
                'type': 'tool_result',
                'tool_call_id': wire_msg.tool_call_id,
                'output': output,
            }
        )
    elif isinstance(wire_msg, ApprovalRequest):
        await _flush_pending_tool_call(pending_tool_call, websocket)
        # Auto-approve for now (yolo mode)
        wire_msg.resolve('approve')
        logger.debug(f'Approval: {wire_msg.action}')
        await websocket.send_json(
            {
                'type': 'approval',
                'action': wire_msg.action,
                'description': wire_msg.description,
            }
        )
    elif isinstance(wire_msg, StatusUpdate):
        await _flush_pending_tool_call(pending_tool_call, websocket)
        # Send status update with context usage
        await websocket.send_json(
            {
                'type': 'status',
                'context_usage': wire_msg.context_usage,
                'token_usage': wire_msg.token_usage.model_dump() if wire_msg.token_usage else None,
            }
        )


@router.websocket('/ws/{conv_id}')
async def chat_websocket(websocket: WebSocket, conv_id: str) -> None:
    """WebSocket endpoint for chat."""
    await websocket.accept()

    # Track current session for cancellation
    current_session = None

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)

            # Handle stop signal
            if message_data.get('type') == 'stop':
                if current_session is not None:
                    logger.debug('Stop signal received, cancelling session')
                    current_session.cancel()
                else:
                    logger.debug('Stop signal received but no active session')
                continue

            user_input = message_data.get('message', '')
            attachments = message_data.get('attachments', [])
            thinking = message_data.get('thinking', False)
            model = message_data.get('model', '')

            if not user_input and not attachments:
                continue

            # Get or create session with thinking/model params
            current_session = await conversation_manager.get_or_create_session(
                conv_id,
                thinking=thinking,
                model=model if model else None,
            )
            if current_session is None:
                await websocket.send_json(
                    {
                        'type': 'error',
                        'message': 'Failed to create session',
                    }
                )
                continue

            # Build content parts
            content_parts: list[ContentPart] = []
            if user_input:
                content_parts.append(TextPart(text=user_input))

            # Add image attachments
            for att in attachments:
                if att.get('type') == 'image_url':
                    url = att.get('url', '')
                    if url:
                        content_parts.append(ImageURLPart(image_url=ImageURLPart.ImageURL(url=url)))

            # Send user message back as confirmation
            await websocket.send_json(
                {
                    'type': 'user',
                    'content': user_input,
                }
            )

            # Process through kimi-agent-sdk session
            pending_tool_call: list[ToolCall | None] = [None]
            try:
                async for wire_msg in current_session.prompt(
                    content_parts, merge_wire_messages=False
                ):
                    await _process_wire_message(wire_msg, [], websocket, pending_tool_call)
                await _flush_pending_tool_call(pending_tool_call, websocket)
            except RunCancelled:
                logger.debug('Generation was cancelled by user')
                await _flush_pending_tool_call(pending_tool_call, websocket)
            except (
                RuntimeError,
                ValueError,
                OSError,
                ConnectionError,
                TimeoutError,
                KeyError,
                TypeError,
            ) as e:
                logger.exception('Error during generation')
                await websocket.send_json(
                    {
                        'type': 'error',
                        'message': f'Generation error: {e}',
                    }
                )

            # Send completion signal (stream is complete or stopped)
            await websocket.send_json(
                {
                    'type': 'complete',
                }
            )

            # Update conversation stats
            conv = await conversation_manager.get_conversation(conv_id)
            if conv:
                await conversation_manager.update_conversation(
                    conv_id,
                    message_count=conv.message_count + 2,  # user + assistant
                )

            # Clear current session reference
            current_session = None

    except WebSocketDisconnect:
        # Client disconnected, session remains for resume
        pass
    except (
        json.JSONDecodeError,
        KeyError,
        TypeError,
        ValueError,
        RuntimeError,
        OSError,
    ) as e:
        await websocket.send_json(
            {
                'type': 'error',
                'message': str(e),
            }
        )
