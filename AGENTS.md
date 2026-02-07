# AI Rules

## General

- Response directly in the chat. Do not create extra markdown files to conclude your response.

## Git

- Use the standard cli tools:
  - Do not use bare `curl`, `wget` or `FetchURL` to interact with git repositories. Use `gh` command for github, `glab` command for gitlab.
  - Do not clone repositories to the local machine. Read files with `gh` or `glab` directly from the remote repository.
- Do not create commits or push changes unless explicitly authorized by the user. Only modify files as requested; leave git operations to the user unless they explicitly ask for them.
- When making commits, use conventional commit messages.
- When running git rebase commands (e.g., `git rebase --continue`), always use `-c core.editor=true` to avoid opening an interactive editor. For example: `git -c core.editor=true rebase --continue`. This prevents IDE from opening during automated rebase operations.

## Python (backend)

- This project uses `uv` to manage Python environments. When running Python programs or commands, you should first activate the virtual environment by running `source .venv/bin/activate`, then you can directly invoke `python` or other Python tools. After adding dependencies, you should run `uv sync -U --all-extras` to install them.
- **Lint**: Backend lint (ruff, ty, codespell, ast-grep) is run via `pre-commit`. After completing development, run `pre-commit run --all` to verify (no need to run ruff/ty separately). Resolve issues properly; do not use `# noqa`, `# type: ignore`, or similar to skip errors. Use `cast` cautiously; the only allowed use is when creating a MagicMock or similar and casting it to the type of the object being created.
- **Test**: Run tests with `uv run pytest` (see `.github/workflows/pytest.yml` for CI). You must write unit tests for the features you implement; you may run only modified tests to save time.
- Minimize the use of `Any` or `object` and try to find specific types for the variables, this will help you to write better code and avoid type errors.
- In test files, minimize the use of `hasattr`, `setattr`, and `getattr` methods. Prefer type narrowing (using `isinstance`) or `cast` instead. This improves type safety and makes the code more maintainable.
- Prefer `pydantic.BaseModel` over `TypedDict` when possible, and prefer `TypedDict` over untyped `dict` when possible.

## Frontend

- **Lint**: TypeScript type checking is run via `npm run lint` (`tsc --noEmit`). Frontend lint is invoked by `pre-commit` together with backend lint (when `web/` files change). There is no ESLint configuration; the build (`npm run build`) also runs `tsc`.
- **Test**: The project uses `vitest`. Run `npm test` to execute tests; `npm run test:typecheck` type-checks test code. Write tests for components and utilities you implement, placing test files alongside the source with a `.test.ts` or `.test.tsx` suffix.

## Project

- The project has a frontend-backend separated structure; the frontend implementation is largely based on [kimi-cli](https://github.com/MoonshotAI/kimi-cli). Refer to that repo when you need details.
- kimi-agent-sdk is the only agent harness. Refer to its [source code]((https://github.com/MoonshotAI/kimi-agent-sdk)) and [examples](https://github.com/MoonshotAI/kimi-agent-sdk/tree/main/examples/python) when you need details.
