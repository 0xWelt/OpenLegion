"""Chat API routes and WebSocket handler."""

from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from kimi_agent_sdk import ApprovalRequest, ToolResult
from kimi_cli.wire.types import StatusUpdate
from kosong.message import ContentPart, ImageURLPart, TextPart, ThinkPart, ToolCall
from loguru import logger

from legion.conversations import conversation_manager


router = APIRouter(prefix='/api/conversations', tags=['conversations'])


@router.get('')
async def list_conversations() -> dict[str, list[dict[str, Any]]]:
    """List all conversations."""
    conversations = await conversation_manager.list_conversations()
    return {'conversations': [conv.to_dict() for conv in conversations]}


@router.post('')
async def create_conversation(data: dict[str, Any]) -> dict[str, Any]:
    """Create a new conversation."""
    title = data.get('title', 'New Conversation')
    work_dir = data.get('work_dir')

    conv = await conversation_manager.create_conversation(title, work_dir)
    return {'conversation': conv.to_dict()}


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
async def update_conversation(conv_id: str, data: dict[str, Any]) -> Response:
    """Update conversation metadata."""
    title = data.get('title')
    message_count = data.get('message_count')

    conv = await conversation_manager.update_conversation(
        conv_id, title=title, message_count=message_count
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
    return JSONResponse({'messages': messages})


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


async def _process_wire_message(
    wire_msg: Any,
    response_chunks: list[str],
    websocket: WebSocket,
) -> None:
    """Process a single wire message and send appropriate response."""
    msg_type = type(wire_msg).__name__
    logger.debug(f'Processing wire message: {msg_type}')

    # Handle ContentPart subtypes (TextPart, ThinkPart, etc.)
    if isinstance(wire_msg, ContentPart):
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
                    'type': 'thinking',
                    'content': wire_msg.think,
                }
            )
    elif isinstance(wire_msg, ToolCall):
        tool_name = wire_msg.function.name if hasattr(wire_msg.function, 'name') else 'unknown'
        arguments = wire_msg.function.arguments if hasattr(wire_msg.function, 'arguments') else {}
        logger.debug(f'Tool call: {tool_name}')
        await websocket.send_json(
            {
                'type': 'tool_call',
                'tool_name': tool_name,
                'arguments': arguments,
            }
        )
    elif isinstance(wire_msg, ToolResult):
        output = wire_msg.output if hasattr(wire_msg, 'output') else str(wire_msg)
        logger.debug(f'Tool result: {output[:50]}...')
        await websocket.send_json(
            {
                'type': 'tool_result',
                'tool_call_id': wire_msg.tool_call_id,
                'output': output,
            }
        )
    elif isinstance(wire_msg, ApprovalRequest):
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

    # Get or create session
    session = await conversation_manager.get_or_create_session(conv_id)
    if session is None:
        await websocket.send_json(
            {
                'type': 'error',
                'message': 'Conversation not found',
            }
        )
        await websocket.close()
        return

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            user_input = message_data.get('message', '')
            attachments = message_data.get('attachments', [])

            if not user_input and not attachments:
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
            # Use merge_wire_messages=False for true streaming
            response_chunks: list[str] = []
            async for wire_msg in session.prompt(content_parts, merge_wire_messages=False):
                await _process_wire_message(wire_msg, response_chunks, websocket)

            # Send final response
            full_response = ''.join(response_chunks)
            await websocket.send_json(
                {
                    'type': 'assistant',
                    'content': full_response,
                }
            )

            # Update conversation stats
            conv = await conversation_manager.get_conversation(conv_id)
            if conv:
                await conversation_manager.update_conversation(
                    conv_id,
                    message_count=conv.message_count + 2,  # user + assistant
                )

    except WebSocketDisconnect:
        # Client disconnected, session remains for resume
        pass
    except Exception as e:  # noqa: BLE001
        await websocket.send_json(
            {
                'type': 'error',
                'message': str(e),
            }
        )
