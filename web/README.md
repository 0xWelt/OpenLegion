# Legion Frontend

React-based dashboard for Legion, inspired by OpenClaw design.

## Features

- **Dark theme** - Matching OpenClaw's aesthetic
- **Collapsible sidebar** - Toggle between full and icon-only modes
- **Responsive design** - Works on desktop and mobile
- **Real-time updates** - WebSocket connection to backend

## Pages

- **Overview** - Gateway status, metrics, and system health
- **Chat** - AI conversation interface
- **Channels** - Messaging platform connections (WhatsApp, Telegram, etc.)
- **Instances** - Running agent instances management
- **Sessions** - Active conversation sessions
- **Skills** - Agent capabilities and tools
- **Nodes** - Distributed agent nodes
- **Config** - System configuration
- **Logs** - System logs and diagnostics

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- Lucide React (icons)
- React Router (routing)
