# Legion Backend

Python backend for Legion with FastAPI and Typer CLI.

## Architecture

```
backend/
├── cli.py      # Typer CLI commands (start/stop/restart/status/web)
├── server.py   # FastAPI server entry point
├── service.py  # Service management logic
└── api/        # API routes
```

## CLI Commands

```bash
# Start the Legion service
legion start

# Check service status
legion status

# Stop the service
legion stop

# Restart the service
legion restart

# Open web UI
legion web
```

## API Endpoints

- `GET /api/status` - Service status
- `WS /ws` - WebSocket for real-time updates

## Service Management

The service runs as a background daemon:
- PID file: `~/.legion/legion.pid`
- Log file: `~/.legion/legion.log`
- Default port: 18789
