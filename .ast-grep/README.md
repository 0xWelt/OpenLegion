# ast-grep Rules

This directory contains custom ast-grep rules for code quality checks.

## Rules

- `do-not-import-json`: Prevent direct json module import
- `check-tenacity-before-sleep-log`: Prevent using tenacity.before_sleep_log
- `pytest-skip-on-ci`: Enforce consistent skip_on_ci marker usage
- `call-dunder-exit`: Prevent direct __exit__/__aexit__ calls

## Usage

```bash
ast-grep scan
```
