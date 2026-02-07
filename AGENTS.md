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

## Python

- This project uses `uv` to manage Python environments. When running Python programs or commands, you should first activate the virtual environment by running `source .venv/bin/activate`, then you can directly invoke `python` or other Python tools. After adding dependencies, you should run `uv sync -U --all-extras` to install them.
- You must write unit tests for the features you implement. Refer to `.gitlab-ci.yml` for the full test command, but you can only test modified parts to save time.
- This project uses `pre-commit` to control code quality, which mainly includes `ruff` and `ty` checks. After completing development, you should run `pre-commit run --all` to verify overall quality (no need to run `ruff` and `ty` separately, just run `pre-commit`).
  - Issues found should be properly resolved, and you should not use `# noqa`, `# type: ignore`, or similar methods to skip errors.
  - Use `cast` cautiously and handle all types properly. The only case you are allowed to use `cast` is when you create a MagicMock or similar object, you can cast it into the type of the object you are creating.
- Minimize the use of `Any` or `object` and try to find specific types for the variables, this will help you to write better code and avoid type errors.
- In test files, minimize the use of `hasattr`, `setattr`, and `getattr` methods. Prefer type narrowing (using `isinstance`) or `cast` instead. This improves type safety and makes the code more maintainable.
- Prefer `pydantic.BaseModel` over `TypedDict` when possible, and prefer `TypedDict` over untyped `dict` when possible.

## Frontend

- **Lint**: The project uses TypeScript (`tsc`) for type checking, which is integrated into the build process (`npm run build`). There is no separate ESLint configuration currently. Ensure your code passes TypeScript type checking before committing.
- **Test**: The project uses `vitest` for testing. Run `npm test` to execute tests. You should write tests for components and utilities you implement, placing test files alongside the source files with a `.test.ts` or `.test.tsx` suffix.

## Project

- The project has a frontend-backend separated structure; the frontend implementation is largely based on [kimi-cli](https://github.com/MoonshotAI/kimi-cli). Refer to that repo when you need details.
- kimi-agent-sdk is the only agent harness. Refer to its [source code]((https://github.com/MoonshotAI/kimi-agent-sdk)) and [examples](https://github.com/MoonshotAI/kimi-agent-sdk/tree/main/examples/python) when you need details.
