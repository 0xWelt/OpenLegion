"""Legion FastAPI server."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from legion.service import create_app


def run_server(host: str = '127.0.0.1', port: int = 18790) -> None:
    """Run the Legion server."""
    import uvicorn

    app = create_app()

    # Write PID file
    pid_file = Path.home() / '.legion' / 'legion.pid'
    pid_file.parent.mkdir(parents=True, exist_ok=True)
    pid_file.write_text(str(os.getpid()))

    uvicorn.run(app, host=host, port=port, log_level='info')


def main() -> None:
    """Main entry point for server."""
    parser = argparse.ArgumentParser(description='Legion Server')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=18790, help='Port to bind to')
    args = parser.parse_args()

    run_server(host=args.host, port=args.port)


if __name__ == '__main__':
    main()
