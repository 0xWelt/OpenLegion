#!/usr/bin/env python3
"""Build web UI and sync to legion package."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from loguru import logger


class BuildError(Exception):
    """Build error with message."""


# Paths
PROJECT_ROOT = Path(__file__).parent.parent
WEB_DIR = PROJECT_ROOT / 'web'
DIST_DIR = WEB_DIR / 'dist'
STATIC_DIR = PROJECT_ROOT / 'legion' / 'web' / 'static'
NODE_MODULES = WEB_DIR / 'node_modules'


def resolve_npm() -> str:
    """Find npm executable."""
    npm = shutil.which('npm')
    if npm:
        return npm
    npm = shutil.which('pnpm')
    if npm:
        return npm
    npm = shutil.which('yarn')
    if npm:
        return npm
    msg = 'npm/pnpm/yarn not found'
    raise BuildError(msg)


def run_npm(npm: str, args: list[str]) -> None:
    """Run npm command."""
    cmd = [npm, *args]
    logger.info(f'Running: {" ".join(cmd)}')
    subprocess.run(cmd, cwd=WEB_DIR, check=True)  # noqa: S603


def main() -> int | None:
    """Build web UI and sync to legion package."""
    try:
        npm = resolve_npm()
        logger.info(f'Using npm: {npm}')

        # Install dependencies if needed
        if not NODE_MODULES.exists():
            logger.info('Installing dependencies...')
            run_npm(npm, ['install'])

        # Build web UI
        logger.info('Building web UI...')
        run_npm(npm, ['run', 'build'])

        # Verify dist exists
        if not DIST_DIR.exists():
            logger.error(f'Error: {DIST_DIR} not found after build')
            return 1

        # Sync to legion package
        if STATIC_DIR.exists():
            logger.info(f'Removing old static dir: {STATIC_DIR}')
            shutil.rmtree(STATIC_DIR)

        logger.info(f'Copying {DIST_DIR} -> {STATIC_DIR}')
        shutil.copytree(DIST_DIR, STATIC_DIR)

        logger.info(f'Web UI built and synced to {STATIC_DIR}')
    except subprocess.CalledProcessError as e:
        logger.error(f'Error running npm: {e}')
        return 1
    except Exception as e:  # noqa: BLE001
        logger.error(f'Error: {e}')
        return 1


if __name__ == '__main__':
    sys.exit(main())
