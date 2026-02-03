.PHONY: help web-back web-front build-web install dev

help:  ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development commands
web-back:  ## Start web backend with uvicorn (reload enabled)
	@LOG_LEVEL=DEBUG uv run uvicorn legion.service:create_app --factory --reload --port 18790

web-front:  ## Start web frontend (vite dev server)
	@npm --prefix web run dev

# Build commands
build-web:  ## Build web UI and sync into legion package
	@echo "==> Building web UI"
	@uv run scripts/build_web.py

install:  ## Install dependencies
	@uv sync --all-extras

# Combined commands
dev:  ## Start both backend and frontend (run in separate terminals)
	@echo "Run these commands in separate terminals:"
	@echo "  Terminal 1: make web-back"
	@echo "  Terminal 2: make web-front"
