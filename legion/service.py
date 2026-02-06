"""Service management for Legion daemon."""

from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

import psutil
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from loguru import logger
from pydantic import BaseModel
from rich.console import Console
from rich.table import Table

from legion.chat_router import router as chat_router
from legion.conversations import conversation_manager


class StatusResponse(BaseModel):
    """GET /api/status response."""

    status: str
    """Service status string."""
    version: str
    """API version."""
    timestamp: float
    """Current time from event loop."""


class RootResponse(BaseModel):
    """GET / when static files not built."""

    message: str
    """Short API message."""
    version: str
    """API version."""
    note: str
    """Note about building the web UI."""


console = Console()

PID_FILE = Path.home() / '.legion' / 'legion.pid'
LOG_FILE = Path.home() / '.legion' / 'legion.log'

# Static files directory (built web UI)
LEGION_ROOT = Path(__file__).parent
STATIC_DIR = LEGION_ROOT / 'web' / 'static'


class LegionService:
    """Legion service manager."""

    def __init__(self) -> None:
        self.pid_file = PID_FILE
        self.log_file = LOG_FILE
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        """Ensure required directories exist."""
        self.pid_file.parent.mkdir(parents=True, exist_ok=True)

    def get_pid(self) -> int | None:
        """Get current service PID if running."""
        if not self.pid_file.exists():
            return None
        try:
            pid = int(self.pid_file.read_text().strip())
            if psutil.pid_exists(pid):
                return pid
            else:
                self.pid_file.unlink(missing_ok=True)
                return None
        except (ValueError, FileNotFoundError):
            return None

    def is_running(self) -> bool:
        """Check if service is running."""
        return self.get_pid() is not None

    def start(self, host: str = '127.0.0.1', port: int = 18790) -> bool:
        """Start the Legion service."""
        if self.is_running():
            pid = self.get_pid()
            console.print(f'[yellow]Legion is already running (PID: {pid})[/yellow]')
            return False

        console.print('[cyan]Starting Legion service...[/cyan]')

        # Check if web UI is built
        if not STATIC_DIR.exists():
            console.print('[yellow]Warning: Web UI not built.[/yellow]')
            console.print('[dim]Run: python scripts/build_web.py[/dim]')

        # Start server in background using subprocess
        stdout = subprocess.DEVNULL
        stderr = subprocess.DEVNULL
        creationflags = 0
        if sys.platform == 'win32':
            creationflags = subprocess.CREATE_NEW_CONSOLE
        else:
            # Unix: redirect output to log file
            stdout = open(self.log_file, 'w')  # noqa: SIM115

        subprocess.Popen(  # noqa: S603
            [sys.executable, '-m', 'legion.server', '--host', host, '--port', str(port)],
            creationflags=creationflags,
            stdout=stdout,
            stderr=stderr,
            start_new_session=True,
        )

        # Wait a moment and check if started
        time.sleep(1)
        if self.is_running():
            console.print('[green]Legion started successfully![/green]')
            console.print(f'[dim]Web UI: http://{host}:{port}[/dim]')
            return True
        console.print('[red]Failed to start Legion[/red]')
        return False

    def stop(self) -> bool:
        """Stop the Legion service."""
        pid = self.get_pid()
        if pid is None:
            console.print('[yellow]Legion is not running[/yellow]')
            return False

        console.print(f'[cyan]Stopping Legion (PID: {pid})...[/cyan]')
        try:
            process = psutil.Process(pid)
            process.terminate()
            process.wait(timeout=5)
        except psutil.NoSuchProcess:
            self.pid_file.unlink(missing_ok=True)
            console.print('[yellow]Legion was not running[/yellow]')
            return False
        except psutil.TimeoutExpired:
            console.print('[red]Failed to stop Legion gracefully[/red]')
            return False
        else:
            self.pid_file.unlink(missing_ok=True)
            console.print('[green]Legion stopped successfully[/green]')
            return True

    def restart(self) -> bool:
        """Restart the Legion service."""
        console.print('[cyan]Restarting Legion...[/cyan]')
        self.stop()

        time.sleep(1)
        return self.start()

    def status(self) -> None:
        """Print service status."""
        pid = self.get_pid()

        table = Table(title='Legion Service Status', show_header=True)
        table.add_column('Property', style='cyan')
        table.add_column('Value', style='green')

        if pid:
            try:
                process = psutil.Process(pid)
                table.add_row('Status', '[green]Running[/green]')
                table.add_row('PID', str(pid))
                table.add_row('Started', process.create_time().strftime('%Y-%m-%d %H:%M:%S'))
                table.add_row('Memory', f'{process.memory_info().rss / 1024 / 1024:.1f} MB')
                table.add_row('CPU', f'{process.cpu_percent()}%')
            except psutil.NoSuchProcess:
                table.add_row('Status', '[red]Not Running (stale PID)[/red]')
                self.pid_file.unlink(missing_ok=True)
        else:
            table.add_row('Status', '[red]Not Running[/red]')

        table.add_row('PID File', str(self.pid_file))
        table.add_row('Log File', str(self.log_file))
        table.add_row(
            'Web UI Built', '[green]Yes[/green]' if STATIC_DIR.exists() else '[red]No[/red]'
        )

        console.print(table)


def create_app() -> FastAPI:
    """Create FastAPI application."""

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        console.print('[dim]Legion server starting...[/dim]')
        yield
        console.print('[dim]Legion server stopping...[/dim]')
        # Close all conversation sessions on shutdown
        await conversation_manager.close_all()

    app = FastAPI(title='Legion', version='0.1.0', lifespan=lifespan)

    # Include chat router
    app.include_router(chat_router)

    @app.get('/api/status')
    async def get_status() -> StatusResponse:
        return StatusResponse(
            status='running',
            version='0.1.0',
            timestamp=asyncio.get_event_loop().time(),
        )

    @app.websocket('/ws')
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                # Echo back for now
                await websocket.send_json(
                    {
                        'type': 'echo',
                        'data': message,
                    }
                )
        except Exception as e:  # noqa: BLE001
            logger.debug(f'WebSocket error: {e}')

    # Mount static files as fallback (must be after API routes)
    if STATIC_DIR.exists():
        app.mount('/', StaticFiles(directory=STATIC_DIR, html=True), name='static')
    else:

        @app.get('/')
        async def root() -> RootResponse:
            return RootResponse(
                message='Legion API Server',
                version='0.1.0',
                note='Web UI not built. Run: python scripts/build_web.py',
            )

    return app
