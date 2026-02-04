# OpenLegion

[![CI](https://github.com/0xWelt/OpenLegion/workflows/Pytest/badge.svg)](https://github.com/0xWelt/OpenLegion/actions)
[![Python 3.13](https://img.shields.io/badge/python-3.13-blue.svg)](https://www.python.org/downloads/)
[![uv](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/uv/main/assets/badge/v0.json)](https://github.com/astral-sh/uv)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[English](../README.md) | [中文](README.ZH.md) | [日本語](README.JP.md) | [한국어](README.KR.md)

又一个用 Python 编写的 OpenClaw。

## 致谢

- **开发工具**：本项目几乎完全使用 [kimi-cli](https://github.com/MoonshotAI/kimi-cli) 配合 [k2.5](https://github.com/MoonshotAI/Kimi-K2.5) 模型开发完成。
- **灵感来源**：本项目受到 [OpenClaw](https://github.com/openclaw/openclaw) 的启发。

## 安装

使用 [uv](https://github.com/astral-sh/uv) 安装 Legion：

```bash
uv tool install git+https://github.com/0xWelt/OpenLegion
```

## 快速开始

启动 Legion 服务并打开 Web UI：

```bash
legion web
```

此命令会自动启动服务（如未运行）并打开浏览器。

## 开发

在本地开发时，使用热重载模式同时启动前后端：

```bash
# 终端 1：启动后端 API 服务
make web-back

# 终端 2：启动前端开发服务器
make web-front
```

前端开发服务器会输出本地地址（通常是 `http://localhost:5173`）——在浏览器中打开即可。

## 仓库分析

![Repobeats analytics image](https://repobeats.axiom.co/api/embed/a13b7fa00770af08b76903a21729c18e8c01387f.svg)

## 贡献者

<a href="https://github.com/0xWelt/OpenLegion/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=0xWelt/OpenLegion" alt="Contributors" />
</a>

## Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=0xWelt/OpenLegion&type=Date)](https://star-history.com/#0xWelt/OpenLegion&Date)

## 许可证

本项目采用 Apache License 2.0 许可证 - 详情请参阅 [LICENSE](../LICENSE) 文件。
