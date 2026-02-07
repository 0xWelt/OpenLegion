# OpenLegion

[![CI](https://github.com/0xWelt/OpenLegion/workflows/Pytest/badge.svg)](https://github.com/0xWelt/OpenLegion/actions)
[![Python 3.13](https://img.shields.io/badge/python-3.13-blue.svg)](https://www.python.org/downloads/)
[![uv](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/uv/main/assets/badge/v0.json)](https://github.com/astral-sh/uv)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[English](README.md) | [中文](docs/README.ZH.md) | [日本語](docs/README.JP.md) | [한국어](docs/README.KR.md)

Yet another OpenClaw written in Python.

## Acknowledgement

- **Development Tools**: This project is almost entirely developed using [kimi-cli](https://github.com/MoonshotAI/kimi-cli) with the [k2.5](https://github.com/MoonshotAI/Kimi-K2.5) model.
- **Inspiration**: This project is inspired by [OpenClaw](https://github.com/openclaw/openclaw).

## Quick Start (in develop mode)

**Prerequisite**: Legion relies on [Kimi Code](https://www.kimi.com/code) (also known as kimi-cli) for its backend. Please set up Kimi Code first — Legion will reuse all of its configuration (including API tokens).

Clone the repository and run locally with hot-reload for both frontend and backend:

```bash
git clone https://github.com/0xWelt/OpenLegion.git
cd OpenLegion
make install
```

Then in separate terminals:

```bash
# Terminal 1: Start backend API server
make web-back

# Terminal 2: Start frontend dev server
make web-front
```

The frontend dev server will print the local URL (usually `http://localhost:5173`) — open it in your browser.

## Repo Analytics

![Repobeats analytics image](https://repobeats.axiom.co/api/embed/a13b7fa00770af08b76903a21729c18e8c01387f.svg)

## Contributors

<a href="https://github.com/0xWelt/OpenLegion/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=0xWelt/OpenLegion" alt="Contributors" />
</a>

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=0xWelt/OpenLegion&type=Date)](https://star-history.com/#0xWelt/OpenLegion&Date)

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
