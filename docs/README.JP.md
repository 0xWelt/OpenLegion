# OpenLegion

[![CI](https://github.com/0xWelt/OpenLegion/workflows/Pytest/badge.svg)](https://github.com/0xWelt/OpenLegion/actions)
[![Python 3.13](https://img.shields.io/badge/python-3.13-blue.svg)](https://www.python.org/downloads/)
[![uv](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/uv/main/assets/badge/v0.json)](https://github.com/astral-sh/uv)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[English](../README.md) | [中文](README.ZH.md) | [日本語](README.JP.md) | [한국어](README.KR.md)

Python で書かれた、また別の OpenClaw。

## 謝辞

- **開発ツール**：このプロジェクトはほぼ完全に [kimi-cli](https://github.com/MoonshotAI/kimi-cli) と [k2.5](https://github.com/MoonshotAI/Kimi-K2.5) モデルを使用して開発されました。
- **インスピレーション**：このプロジェクトは [OpenClaw](https://github.com/openclaw/openclaw) に触発されています。

## 開発

ローカル開発時に、ホットリロードを有効にして前后端を同时に起動：

```bash
# ターミナル 1：バックエンド API サーバーを起動
make web-back

# ターミナル 2：フロントエンド開発サーバーを起動
make web-front
```

その後、`http://localhost:5173` を開いてホットリロード対応の Web UI にアクセス。

## リポジトリ分析

![Repobeats analytics image](https://repobeats.axiom.co/api/embed/a13b7fa00770af08b76903a21729c18e8c01387f.svg)

## 貢献者

<a href="https://github.com/0xWelt/OpenLegion/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=0xWelt/OpenLegion" alt="Contributors" />
</a>

## Star 履歴

[![Star History Chart](https://api.star-history.com/svg?repos=0xWelt/OpenLegion&type=Date)](https://star-history.com/#0xWelt/OpenLegion&Date)

## ライセンス

このプロジェクトは Apache License 2.0 の下でライセンスされています - 詳細は [LICENSE](../LICENSE) ファイルを参照してください。
