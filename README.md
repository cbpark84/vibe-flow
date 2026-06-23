# ⚡ Vibe Flow

> VSCode 사이드 패널에서 AI와 채팅하며 Claude Code처럼 코딩할 수 있는 플러그인

[![VSCode](https://img.shields.io/badge/VSCode-1.85%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

## Features

- **AI 채팅 인터페이스** - Claude와 자연어로 대화하면서 개발 작업 수행
- **파일 읽기/쓰기** - AI가 파일을 읽고 수정하며, 사용자 승인 후 적용 (diff 미리보기)
- **터미널 실행** - 쉘 명령 실행 (위험 명령어 자동 차단 + 사용자 승인)
- **API 키 보안 저장** - VSCode SecretStorage에서 암호화 저장 (코드/파일에 절대 저장 안 함)
- **스트리밍 응답** - 실시간으로 AI 응답 스트리밍
- **멀티 프로바이더 준비** - 현재 Claude, 향후 OpenAI/Gemini/Ollama 지원 예정

## Requirements

- **VSCode** 1.85 이상
- **Node.js** 18 이상
- **Claude API 키** ([Anthropic](https://console.anthropic.com)에서 발급)

## Installation (개발용)

```bash
# 1. 저장소 클론
git clone <repository-url>
cd cc_플러그인_개발

# 2. 의존성 설치
npm install

# 3. 전체 빌드
npm run compile
```

## Quick Start

### 1. API 키 설정

VSCode 커맨드 팔레트를 열고 (Cmd+Shift+P 또는 Ctrl+Shift+P):

```
> Vibe Flow: Set API Key
```

Claude API 키를 입력하면 VSCode의 보안 저장소에 저장됩니다.

### 2. 채팅 패널 열기

사이드바의 **Vibe Flow** 아이콘을 클릭하거나, 커맨드 팔레트에서:

```
> Vibe Flow: Open Chat
```

### 3. 대화 시작

채팅창에서 자연어로 지시하면 AI가 파일을 읽고, 수정하고, 명령을 실행합니다.

**예시:**
```
"src/index.ts 파일을 읽어줄 수 있어?"
"package.json에 lodash 의존성 추가해줘"
"npm install 실행해줄 수 있어?"
"이 함수의 버그를 고쳐줘" (파일 내용 함께 제공)
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 사용자 채팅 입력                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 2. Extension Host → Claude API (도구 정의 포함)            │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 3. Claude 응답 (텍스트 또는 도구 호출 요청)                │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
    ┌─────▼─────┐        ┌─────▼─────┐
    │ 텍스트    │        │ 도구 호출 │
    │ 스트리밍  │        │ (파일/터미널)
    └─────┬─────┘        └─────┬─────┘
          │                     │
          │            ┌────────▼────────┐
          │            │ 사용자 승인?   │
          │            │ (미리보기 제시) │
          │            └────────┬────────┘
          │                     │
          └──────────┬──────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 4. WebView에 스트리밍 (postMessage)                       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 5. 사용자 화면에 실시간 표시                               │
└─────────────────────────────────────────────────────────────┘
```

### 도구 (Tools)

Vibe Flow가 제공하는 AI 도구:

| 도구 | 설명 | 승인 필요 |
|------|------|---------|
| `read_file` | 파일 내용 읽기 | 아니오 |
| `write_file` | 파일 생성/수정 | **예** (diff 미리보기) |
| `run_terminal` | 쉘 명령 실행 | **예** (위험 패턴 감지) |

## Security

### API 키 보안

- **저장 위치**: VSCode SecretStorage (OS 자격증명 관리자 암호화)
- **코드에 절대 저장 안 함**: 설정 파일이나 소스 코드에 평문 저장 금지
- **읽기 시점**: 채팅 시작 시에만 메모리에 로드

### 위험 명령어 차단 (DANGEROUS_PATTERNS)

터미널 실행 요청 시 다음 패턴 자동 감지 및 사용자에게 경고:

- `rm -rf /`, `rm -rf ~`: 루트/홈 하위 재귀 삭제
- `rm -rf *`: 와일드카드 재귀 삭제
- `sudo`, `su`: 관리자 권한 실행
- `chmod 777`, `chown root`: 과도한 권한 부여
- `mkfs.`, `dd if=`: 파일시스템/블록 디바이스 작업
- `curl|sh`, `wget|sh`: 원격 스크립트 즉시 실행
- Fork bomb (`:() { :|:& };:`): 프로세스 폭탄
- `shutdown`, `reboot`, `halt`: 시스템 종료/재시작
- `pkill`, `killall -9`: 강제 프로세스 종료
- `npm publish`: 패키지 공개 배포
- `git push --force`: 강제 푸시

**모든 위험 명령어는 사용자 승인 후에만 실행됩니다.**

## Development

### 빌드 명령어

```bash
# Extension Host 빌드 (TypeScript → JavaScript)
npm run compile:ext

# WebView 빌드 (React + Vite)
npm run compile:web

# 전체 빌드
npm run compile

# 파일 변경 감지 빌드
npm run watch:ext     # Extension
npm run watch:web     # WebView
```

### 린팅 및 포매팅

```bash
# ESLint 검사
npm run lint

# Prettier 자동 포매팅
npm run format

# 함께 실행
npm run compile && npm run lint && npm run format
```

### F5 디버그 실행

VSCode에서 **F5**를 누르면 **Extension Development Host**가 실행됩니다.
- 새로운 VSCode 창이 열림
- 플러그인 코드 변경 시 자동 재로드 (watch 모드)
- DevTools 접근 가능 (WebView 디버깅)

### 빌드 결과물

```
dist/
├── extension.js          # Extension Host (esbuild)
└── webview/
    ├── index.html        # WebView HTML
    └── assets/           # JS, CSS 번들
```

## Project Structure

```
src/
├── extension.ts                    # Extension Host 진입점
│   └── TOOLS 배열, 도구 실행, postMessage 처리
├── providers/
│   ├── base.ts                     # ILLMProvider 인터페이스
│   ├── claude.ts                   # Claude 프로바이더
│   └── factory.ts                  # 프로바이더 팩토리
├── tools/
│   ├── fileSystem.ts               # 파일 읽기/쓰기 도구
│   ├── terminal.ts                 # 터미널 실행 도구 (위험 패턴 차단)
│   └── types.ts                    # 도구 타입 정의
├── webview/
│   ├── main.tsx                    # React 진입점
│   ├── App.tsx                     # 메인 채팅 UI
│   ├── components/
│   │   ├── ChatPanel.tsx           # 채팅 인터페이스
│   │   ├── MessageBubble.tsx       # 메시지 버블
│   │   └── ToolApproval.tsx        # 파일/터미널 승인 UI
│   └── hooks/
│       ├── useChat.ts              # 채팅 로직
│       └── useVSCode.ts            # VSCode API 접근
└── utils/
    ├── secretStorage.ts            # API 키 보안 저장
    ├── contextManager.ts           # 토큰 관리
    ├── logger.ts                   # VSCode OutputChannel 래퍼
    └── types.ts                    # 공용 타입

test/                                # Extension 테스트
esbuild.config.js                    # Extension 빌드 설정
vite.config.ts                       # WebView 빌드 설정
package.json
tsconfig.json
README.md (이 파일)
```

## Roadmap

| Phase | 목표 | 상태 | 예상 완료 |
|-------|------|------|---------|
| **1** | MVP: Claude + 파일 + 터미널 | ✅ 완료 | 2026-06-24 |
| **2** | 멀티 프로바이더 (OpenAI, Gemini, Ollama) | 🔜 예정 | 2026-07-08 |
| **3** | 고급 기능 (list_directory, search_code, 히스토리) | 🔜 예정 | 2026-07-22 |
| **4** | VSCode 마켓플레이스 배포 | 🔜 예정 | 2026-08-05 |

## Troubleshooting

### "Claude API 키를 등록하세요" 에러

1. 커맨드 팔레트 (Cmd+Shift+P): `> Vibe Flow: Set API Key`
2. [Anthropic Console](https://console.anthropic.com)에서 API 키 발급
3. 키 입력 후 엔터

### "WebView 빌드가 필요합니다" 메시지

WebView가 아직 빌드되지 않았습니다:

```bash
npm run compile:web
```

또는 개발 중 자동 빌드:

```bash
npm run watch:web
```

### 파일을 읽을 수 없음

- 절대 경로 또는 워크스페이스 상대 경로 사용
- 파일 권한 확인 (읽기 권한 필요)

### 터미널 명령이 실행되지 않음

- "승인" 버튼을 클릭했는지 확인
- 위험 명령어 패턴은 자동으로 차단됨
- 명령어 문법 확인

## Contributing

이 프로젝트의 개발 가이드:

- **PLAN.md**: 개발 로드맵 및 아키텍처
- **AGENTS.md**: 코딩 컨벤션 및 에이전트 역할
- **CLAUDE.md**: Claude AI 에이전트 전용 지침

## License

MIT License - 자유롭게 사용, 수정, 배포 가능

## Contact

문제나 제안: [GitHub Issues](https://github.com/your-repo/issues)

---

**Last Updated**: 2026-06-24  
**Version**: 0.1.0 (Phase 1 MVP)
