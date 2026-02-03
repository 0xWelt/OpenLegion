# OpenLegion

[![CI](https://github.com/0xWelt/OpenLegion/workflows/Pytest/badge.svg)](https://github.com/0xWelt/OpenLegion/actions)
[![Python 3.13](https://img.shields.io/badge/python-3.13-blue.svg)](https://www.python.org/downloads/)
[![uv](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/astral-sh/uv/main/assets/badge/v0.json)](https://github.com/astral-sh/uv)
[![Code style: ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[English](../README.md) | [中文](README.ZH.md) | [日本語](README.JP.md) | [한국어](README.KR.md)

Python으로 작성된 또 다른 OpenClaw.

## 감사의 글

- **개발 도구**: 이 프로젝트는 거의 완전히 [kimi-cli](https://github.com/MoonshotAI/kimi-cli)와 [k2.5](https://github.com/MoonshotAI/Kimi-K2.5) 모델을 사용하여 개발되었습니다.
- **영감**: 이 프로젝트는 [OpenClaw](https://github.com/openclaw/openclaw)에서 영감을 받았습니다.

## 개발

로컬 개발 시 핫 리로드와 함께 프론트엔드와 백엔드를 동시에 시작：

```bash
# 터미널 1: 백엔드 API 서버 시작
make web-back

# 터미널 2: 프론트엔드 개발 서버 시작
make web-front
```

그런 다음 `http://localhost:5173`를 열어 핫 리로드가 활성화된 Web UI에 접근。

## 저장소 분석

![Repobeats analytics image](https://repobeats.axiom.co/api/embed/a13b7fa00770af08b76903a21729c18e8c01387f.svg)

## 기여자

<a href="https://github.com/0xWelt/OpenLegion/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=0xWelt/OpenLegion" alt="Contributors" />
</a>

## Star 히스토리

[![Star History Chart](https://api.star-history.com/svg?repos=0xWelt/OpenLegion&type=Date)](https://star-history.com/#0xWelt/OpenLegion&Date)

## 라이선스

이 프로젝트는 Apache License 2.0에 따라 라이선스가 부여됩니다 - 자세한 내용은 [LICENSE](../LICENSE) 파일을 참조하세요.
