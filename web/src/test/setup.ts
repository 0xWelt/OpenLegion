import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Use globalThis so setup is valid under both Node (Vitest) and DOM tsconfig libs.
const g = globalThis as typeof globalThis & {
  WebSocket: typeof WebSocket
  fetch: typeof fetch
  ResizeObserver: typeof ResizeObserver
  IntersectionObserver: typeof IntersectionObserver
}

// Mock WebSocket
g.WebSocket = vi.fn().mockImplementation(() => ({
  send: vi.fn(),
  close: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof WebSocket

// Mock fetch
g.fetch = vi.fn()

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
g.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
g.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))
