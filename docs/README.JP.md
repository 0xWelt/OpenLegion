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

## クイックスタート（開発モード）

**前提条件**：Legion はバックエンドとして [Kimi Code](https://www.kimi.com/code)（kimi-cli とも呼ばれます）に依存しています。まず Kimi Code をセットアップしてください —— Legion はそのすべての設定（API トークンを含む）を再利用します。

リポジトリをクローンし、フロントエンドとバックエンドの両方でホットリロードを有効にしてローカルで実行：

```bash
git clone https://github.com/0xWelt/OpenLegion.git
cd OpenLegion
make install
```

次に、別々のターミナルで：

```bash
# ターミナル 1：バックエンド API サーバーを起動
make web-back

# ターミナル 2：フロントエンド開発サーバーを起動
make web-front
```

フロントエンド開発サーバーがローカル URL（通常は `http://localhost:5173`）を出力します — ブラウザで開いてください。

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
