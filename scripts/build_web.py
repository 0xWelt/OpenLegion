#!/usr/bin/env python3
"""Build web UI and sync to legion package."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
WEB_DIR = PROJECT_ROOT / "web"
DIST_DIR = WEB_DIR / "dist"
STATIC_DIR = PROJECT_ROOT / "legion" / "web" / "static"
NODE_MODULES = WEB_DIR / "node_modules"


def resolve_npm() -> str:
    """Find npm executable."""
    npm = shutil.which("npm")
    if npm:
        return npm
    npm = shutil.which("pnpm")
    if npm:
        return npm
    npm = shutil.which("yarn")
    if npm:
        return npm
    raise RuntimeError("npm/pnpm/yarn not found")


def run_npm(npm: str, args: list[str]) -> None:
    """Run npm command."""
    cmd = [npm] + args
    print(f"Running: {' '.join(cmd)}")
    subprocess.run(cmd, cwd=WEB_DIR, check=True)


def main() -> int:
    """Build web UI and sync to legion package."""
    try:
        npm = resolve_npm()
        print(f"Using npm: {npm}")

        # Install dependencies if needed
        if not NODE_MODULES.exists():
            print("Installing dependencies...")
            run_npm(npm, ["install"])

        # Build web UI
        print("Building web UI...")
        run_npm(npm, ["run", "build"])

        # Verify dist exists
        if not DIST_DIR.exists():
            print(f"Error: {DIST_DIR} not found after build")
            return 1

        # Sync to legion package
        if STATIC_DIR.exists():
            print(f"Removing old static dir: {STATIC_DIR}")
            shutil.rmtree(STATIC_DIR)

        print(f"Copying {DIST_DIR} -> {STATIC_DIR}")
        shutil.copytree(DIST_DIR, STATIC_DIR)

        print(f"✅ Web UI built and synced to {STATIC_DIR}")
        return 0

    except subprocess.CalledProcessError as e:
        print(f"Error running npm: {e}")
        return 1
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
