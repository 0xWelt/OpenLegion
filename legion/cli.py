"""Legion CLI commands."""

from __future__ import annotations

import time
import webbrowser

import typer
from rich.console import Console

from legion.service import LegionService


app = typer.Typer(name='legion', help='Legion - Yet another OpenClaw')
console = Console()


@app.command()
def start(
    host: str = typer.Option('127.0.0.1', '--host', '-h', help='Host to bind to'),
    port: int = typer.Option(18790, '--port', '-p', help='Port to bind to'),
) -> None:
    """Start the Legion service."""
    service = LegionService()
    service.start(host=host, port=port)


@app.command()
def stop() -> None:
    """Stop the Legion service."""
    service = LegionService()
    service.stop()


@app.command()
def restart(
    host: str = typer.Option('127.0.0.1', '--host', '-h', help='Host to bind to'),
    port: int = typer.Option(18789, '--port', '-p', help='Port to bind to'),
) -> None:
    """Restart the Legion service."""
    service = LegionService()
    service.stop()

    time.sleep(1)
    service.start(host=host, port=port)


@app.command()
def status() -> None:
    """Check Legion service status."""
    service = LegionService()
    service.status()


@app.command()
def web() -> None:
    """Open Legion web UI."""
    service = LegionService()
    if not service.is_running():
        console.print('[yellow]Legion is not running. Starting...[/yellow]')
        service.start()
    webbrowser.open('http://127.0.0.1:18790')


def main() -> None:
    """Main entry point."""
    app()


if __name__ == '__main__':
    main()
