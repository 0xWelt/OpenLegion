import { describe, it, expect } from 'vitest'

// Helper function to format tool call arguments for display
function formatToolCallArguments(args: string | Record<string, unknown> | undefined | null): string {
  if (args === undefined || args === null) {
    return 'No arguments'
  }
  if (typeof args === 'string') {
    // Empty string is valid - tool might have no args, or still streaming
    return args.trim() || '(no arguments)'
  }
  // Object
  return Object.keys(args).length > 0
    ? JSON.stringify(args, null, 2)
    : '(no arguments)'
}

// Helper to check if arguments should be displayed as JSON (parsed object)
function shouldRenderAsJson(args: unknown): args is Record<string, unknown> {
  return typeof args === 'object' && args !== null && !Array.isArray(args)
}

describe('formatToolCallArguments', () => {
  it('should return "No arguments" for undefined', () => {
    expect(formatToolCallArguments(undefined)).toBe('No arguments')
  })

  it('should return "No arguments" for null', () => {
    expect(formatToolCallArguments(null)).toBe('No arguments')
  })

  it('should return string as-is for non-empty strings', () => {
    expect(formatToolCallArguments('{"command": "ls"}')).toBe('{"command": "ls"}')
  })

  it('should return "(no arguments)" for empty string', () => {
    expect(formatToolCallArguments('')).toBe('(no arguments)')
  })

  it('should return "(no arguments)" for whitespace-only string', () => {
    expect(formatToolCallArguments('   ')).toBe('(no arguments)')
  })

  it('should format object as pretty-printed JSON', () => {
    const args = { command: 'ls', flags: '-la' }
    expect(formatToolCallArguments(args)).toBe(JSON.stringify(args, null, 2))
  })

  it('should return "(no arguments)" for empty object', () => {
    expect(formatToolCallArguments({})).toBe('(no arguments)')
  })

  it('should handle complex nested objects', () => {
    const args = {
      command: 'deploy',
      options: {
        env: 'production',
        force: true
      }
    }
    expect(formatToolCallArguments(args)).toBe(JSON.stringify(args, null, 2))
  })

  it('should handle streaming partial JSON string', () => {
    expect(formatToolCallArguments('{"command": "')).toBe('{"command": "')
  })
})

describe('shouldRenderAsJson', () => {
  it('should return true for plain objects', () => {
    expect(shouldRenderAsJson({})).toBe(true)
    expect(shouldRenderAsJson({ a: 1 })).toBe(true)
  })

  it('should return false for strings', () => {
    expect(shouldRenderAsJson('')).toBe(false)
    expect(shouldRenderAsJson('{"a": 1}')).toBe(false)
  })

  it('should return false for null', () => {
    expect(shouldRenderAsJson(null)).toBe(false)
  })

  it('should return false for arrays', () => {
    expect(shouldRenderAsJson([])).toBe(false)
    expect(shouldRenderAsJson([1, 2, 3])).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(shouldRenderAsJson(undefined)).toBe(false)
  })
})

// Test the tool call state management logic
describe('Tool Call State Management', () => {
  interface MessagePart {
    type: string
    tool_name?: string
    arguments?: string | Record<string, unknown>
    isActive?: boolean
    content?: string
  }

  // Simulate the updateStreamingMessage logic for tool_call
  function updateToolCall(
    parts: MessagePart[],
    data: { tool_name: string; arguments?: string | Record<string, unknown> }
  ): MessagePart[] {
    const lastPart = parts[parts.length - 1]

    // Check if we're continuing an active tool_call with string arguments
    if (
      lastPart?.type === 'tool_call' &&
      lastPart.isActive &&
      typeof data.arguments === 'string'
    ) {
      // Append to existing string arguments
      const currentArgs = typeof lastPart.arguments === 'string' ? lastPart.arguments : ''
      return [
        ...parts.slice(0, -1),
        { ...lastPart, arguments: currentArgs + data.arguments }
      ]
    }

    // If data.arguments is an object, update the active tool_call
    if (typeof data.arguments === 'object' && data.arguments !== null) {
      return parts.map(p =>
        p.type === 'tool_call' && p.isActive
          ? { ...p, arguments: data.arguments, isActive: false }
          : p
      )
    }

    // Start a new tool_call (first chunk)
    return [
      ...parts,
      {
        type: 'tool_call',
        tool_name: data.tool_name,
        arguments: data.arguments,
        isActive: true
      }
    ]
  }

  it('should create new tool_call for first chunk', () => {
    const parts: MessagePart[] = []
    const result = updateToolCall(parts, { tool_name: 'Shell', arguments: '{"cmd": "' })

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      type: 'tool_call',
      tool_name: 'Shell',
      arguments: '{"cmd": "',
      isActive: true
    })
  })

  it('should append to existing active tool_call', () => {
    const parts: MessagePart[] = [
      { type: 'tool_call', tool_name: 'Shell', arguments: '{"cmd": "', isActive: true }
    ]
    const result = updateToolCall(parts, { tool_name: 'Shell', arguments: 'ls"}' })

    expect(result).toHaveLength(1)
    expect(result[0].arguments).toBe('{"cmd": "ls"}')
  })

  it('should update with object arguments and mark inactive', () => {
    const parts: MessagePart[] = [
      { type: 'tool_call', tool_name: 'Shell', arguments: '{"cmd": "ls"}', isActive: true }
    ]
    const result = updateToolCall(parts, { tool_name: 'Shell', arguments: { cmd: 'ls' } })

    expect(result[0]).toMatchObject({
      arguments: { cmd: 'ls' },
      isActive: false
    })
  })

  it('should not append to inactive tool_call', () => {
    const parts: MessagePart[] = [
      { type: 'tool_call', tool_name: 'Shell', arguments: '{"cmd": "ls"}', isActive: false }
    ]
    const result = updateToolCall(parts, { tool_name: 'Shell', arguments: '{"new": "arg"}' })

    // Should create new tool_call instead of appending
    expect(result).toHaveLength(2)
    expect(result[1].isActive).toBe(true)
  })
})

// Test parsing logic on complete (frontend handles JSON parsing)
describe('Tool Call Complete Parsing', () => {
  interface ToolCallPart {
    type: 'tool_call'
    tool_name: string
    arguments: string | Record<string, unknown>
    isActive: boolean
  }

  // Frontend parses accumulated string arguments when stream completes
  function parseToolCallOnComplete(part: ToolCallPart): ToolCallPart {
    if (typeof part.arguments === 'string') {
      try {
        const parsed = JSON.parse(part.arguments)
        return { ...part, arguments: parsed, isActive: false }
      } catch {
        return { ...part, isActive: false }
      }
    }
    return { ...part, isActive: false }
  }

  it('should parse valid JSON string to object when tool_call_complete received', () => {
    const part: ToolCallPart = {
      type: 'tool_call',
      tool_name: 'Shell',
      arguments: '{"command": "echo hello", "shell": "bash"}',
      isActive: true
    }
    const result = parseToolCallOnComplete(part)

    expect(result.arguments).toEqual({ command: 'echo hello', shell: 'bash' })
    expect(result.isActive).toBe(false)
  })

  it('should parse JSON with nested objects', () => {
    const part: ToolCallPart = {
      type: 'tool_call',
      tool_name: 'Shell',
      arguments: '{"command": "ls", "options": {"all": true, "long": false}}',
      isActive: true
    }
    const result = parseToolCallOnComplete(part)

    expect(result.arguments).toEqual({ command: 'ls', options: { all: true, long: false } })
    expect(result.isActive).toBe(false)
  })

  it('should parse JSON with unicode content (Chinese characters)', () => {
    const part: ToolCallPart = {
      type: 'tool_call',
      tool_name: 'Shell',
      arguments: '{"command": "echo \\"春眠不觉晓\\""}',
      isActive: true
    }
    const result = parseToolCallOnComplete(part)

    expect(result.arguments).toEqual({ command: 'echo "春眠不觉晓"' })
    expect(result.isActive).toBe(false)
  })

  it('should keep invalid JSON as string when parsing fails', () => {
    const part: ToolCallPart = {
      type: 'tool_call',
      tool_name: 'Shell',
      arguments: '{incomplete json string',
      isActive: true
    }
    const result = parseToolCallOnComplete(part)

    expect(result.arguments).toBe('{incomplete json string')
    expect(result.isActive).toBe(false)
  })

  it('should handle empty string arguments', () => {
    const part: ToolCallPart = {
      type: 'tool_call',
      tool_name: 'Shell',
      arguments: '',
      isActive: true
    }
    const result = parseToolCallOnComplete(part)

    // Empty string is not valid JSON, so it stays as string
    expect(result.arguments).toBe('')
    expect(result.isActive).toBe(false)
  })

  it('should not modify object arguments (already parsed)', () => {
    const part: ToolCallPart = {
      type: 'tool_call',
      tool_name: 'Shell',
      arguments: { command: 'ls' },
      isActive: true
    }
    const result = parseToolCallOnComplete(part)

    expect(result.arguments).toEqual({ command: 'ls' })
    expect(result.isActive).toBe(false)
  })

  it('should handle accumulated string from tool_call_chunks', () => {
    // Simulate accumulated string from multiple chunks
    const accumulatedArgs = '{"command": "echo \\"春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。\\""}'
    const part: ToolCallPart = {
      type: 'tool_call',
      tool_name: 'Shell',
      arguments: accumulatedArgs,
      isActive: true
    }
    const result = parseToolCallOnComplete(part)

    expect(result.arguments).toEqual({
      command: 'echo "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。"'
    })
    expect(result.isActive).toBe(false)
  })
})

// --- formatToolResultOutput (tool result display normalization) ---
function formatToolResultOutput(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

describe('formatToolResultOutput', () => {
  it('returns empty string for null', () => {
    expect(formatToolResultOutput(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatToolResultOutput(undefined)).toBe('')
  })

  it('returns string as-is', () => {
    expect(formatToolResultOutput('hello')).toBe('hello')
    expect(formatToolResultOutput('<system>OK</system>\noutput')).toBe(
      '<system>OK</system>\noutput'
    )
  })

  it('formats object as pretty-printed JSON', () => {
    expect(formatToolResultOutput({ a: 1, b: 2 })).toBe(
      '{\n  "a": 1,\n  "b": 2\n}'
    )
  })

  it('uses String() for other types', () => {
    expect(formatToolResultOutput(42)).toBe('42')
  })
})

// --- tool_call_chunk: append content to active tool_call ---
describe('Tool call chunk appending', () => {
  interface Part {
    type: string
    tool_name?: string
    arguments?: string | Record<string, unknown>
    isActive?: boolean
  }

  function applyToolCallChunk(
    parts: Part[],
    content: string
  ): Part[] {
    const last = parts[parts.length - 1]
    if (last?.type === 'tool_call' && last.isActive) {
      const current = typeof last.arguments === 'string' ? last.arguments : ''
      return [...parts.slice(0, -1), { ...last, arguments: current + content }]
    }
    return parts
  }

  it('appends chunk to last active tool_call', () => {
    const parts: Part[] = [
      { type: 'tool_call', tool_name: 'Shell', arguments: '{"cmd": "', isActive: true }
    ]
    const result = applyToolCallChunk(parts, 'ls"}')
    expect(result).toHaveLength(1)
    expect(result[0].arguments).toBe('{"cmd": "ls"}')
  })

  it('does nothing when last part is not active tool_call', () => {
    const parts: Part[] = [
      { type: 'tool_call', tool_name: 'Shell', arguments: '{}', isActive: false }
    ]
    const result = applyToolCallChunk(parts, 'extra')
    expect(result[0].arguments).toBe('{}')
  })
})

// --- History message building: API messages -> Message[] with tool_result standalone ---
describe('History message building (loadConversation)', () => {
  interface ApiMessage {
    type: string
    content?: string
    thinking?: string
    tool_calls?: Array<{ tool_name: string; arguments?: string | Record<string, unknown> }>
    tool_call_id?: string
    output?: string
  }

  interface BuiltMessage {
    id: string
    role: string
    content: string
    parts?: Array<{ type: string; tool_name?: string; arguments?: unknown; content?: string }>
    tool_call_id?: string
    output?: string
  }

  function buildHistoryMessages(apiMessages: ApiMessage[]): BuiltMessage[] {
    const out: BuiltMessage[] = []
    let currentAssistant: BuiltMessage | null = null
    let idx = 0
    for (const msg of apiMessages) {
      const baseId = `hist-${idx}`
      if (msg.type === 'user') {
        if (currentAssistant) {
          out.push(currentAssistant)
          currentAssistant = null
        }
        out.push({ id: baseId, role: 'user', content: msg.content ?? '' })
      } else if (msg.type === 'assistant') {
        if (currentAssistant) {
          out.push(currentAssistant)
          currentAssistant = null
        }
        const parts: BuiltMessage['parts'] = []
        if (msg.thinking) parts.push({ type: 'thinking', content: msg.thinking })
        if (msg.content?.trim()) parts.push({ type: 'text', content: msg.content })
        if (msg.tool_calls?.length) {
          for (const tc of msg.tool_calls) {
            parts.push({ type: 'tool_call', tool_name: tc.tool_name, arguments: tc.arguments })
          }
        }
        currentAssistant = {
          id: baseId,
          role: 'assistant',
          content: msg.content ?? '',
          parts
        }
      } else if (msg.type === 'tool_result') {
        if (currentAssistant) {
          out.push(currentAssistant)
          currentAssistant = null
        }
        out.push({
          id: baseId,
          role: 'tool_result',
          content: '',
          tool_call_id: msg.tool_call_id,
          output: msg.output
        })
      }
      idx++
    }
    if (currentAssistant) out.push(currentAssistant)
    return out
  }

  it('builds user then assistant then tool_result as three messages', () => {
    const api: ApiMessage[] = [
      { type: 'user', content: 'Run pwd' },
      {
        type: 'assistant',
        content: '',
        thinking: 'I will run pwd',
        tool_calls: [{ tool_name: 'Shell', arguments: { command: 'pwd' } }]
      },
      { type: 'tool_result', tool_call_id: 'Shell:0', output: '/home' }
    ]
    const built = buildHistoryMessages(api)
    expect(built).toHaveLength(3)
    expect(built[0].role).toBe('user')
    expect(built[0].content).toBe('Run pwd')
    expect(built[1].role).toBe('assistant')
    expect(built[1].parts).toHaveLength(2) // thinking + tool_call
    expect(built[2].role).toBe('tool_result')
    expect(built[2].output).toBe('/home')
    expect(built[2].tool_call_id).toBe('Shell:0')
  })

  it('order is thinking -> text -> tool_call in assistant parts', () => {
    const api: ApiMessage[] = [
      {
        type: 'assistant',
        content: 'Done.',
        thinking: 'Thinking...',
        tool_calls: [{ tool_name: 'Shell', arguments: {} }]
      }
    ]
    const built = buildHistoryMessages(api)
    expect(built[0].parts?.map(p => p.type)).toEqual(['thinking', 'text', 'tool_call'])
  })
})

// --- Result loading placeholder: show when last part is completed tool_call and streaming ---
describe('Should show result loading placeholder', () => {
  interface Part {
    type: string
    isActive?: boolean
  }

  function shouldShowResultLoading(isStreaming: boolean, parts: Part[] | undefined): boolean {
    if (!isStreaming || !parts?.length) return false
    const last = parts[parts.length - 1]
    return last.type === 'tool_call' && !last.isActive
  }

  it('returns true when streaming and last part is completed tool_call', () => {
    const parts: Part[] = [
      { type: 'tool_call', isActive: false }
    ]
    expect(shouldShowResultLoading(true, parts)).toBe(true)
  })

  it('returns false when last part is still active tool_call', () => {
    const parts: Part[] = [
      { type: 'tool_call', isActive: true }
    ]
    expect(shouldShowResultLoading(true, parts)).toBe(false)
  })

  it('returns false when not streaming', () => {
    const parts: Part[] = [
      { type: 'tool_call', isActive: false }
    ]
    expect(shouldShowResultLoading(false, parts)).toBe(false)
  })

  it('returns false when parts empty or undefined', () => {
    expect(shouldShowResultLoading(true, [])).toBe(false)
    expect(shouldShowResultLoading(true, undefined)).toBe(false)
  })
})
