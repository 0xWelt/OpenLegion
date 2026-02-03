import { Send, Paperclip } from 'lucide-react'
import { useState } from 'react'

export default function Chat() {
  const [messages, setMessages] = useState([
    { id: 1, role: 'assistant', content: 'Hello! I am Legion, your AI assistant. How can I help you today?' },
  ])
  const [input, setInput] = useState('')

  const handleSend = () => {
    if (!input.trim()) return
    setMessages([...messages, { id: Date.now(), role: 'user', content: input }])
    setInput('')
    // Simulate response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: 'assistant', content: 'I received your message. This is a placeholder response.' },
      ])
    }, 1000)
  }

  return (
    <div className="h-full flex flex-col">
      <h1 className="text-2xl font-semibold mb-4">Chat</h1>
      
      <div className="flex-1 bg-oc-surface rounded-xl border border-oc-border flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] px-4 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-oc-primary text-white'
                    : 'bg-oc-bg border border-oc-border'
                }`}
              >
                <p className="text-sm">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-oc-border">
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-oc-text-muted hover:text-oc-text hover:bg-oc-surface-hover transition-colors">
              <Paperclip size={18} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1 bg-oc-bg border border-oc-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-oc-primary"
            />
            <button
              onClick={handleSend}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-oc-primary text-white hover:bg-oc-primary-hover transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
