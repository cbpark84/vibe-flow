# ⚡ Vibe Flow

> VSCode 사이드 패널에서 AI와 채팅하며 Claude Code처럼 코딩할 수 있는 플러그인

[![VSCode](https://img.shields.io/badge/VSCode-1.85%2B-blue)](https://code.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

## Features

- **멀티 프로바이더** — Claude, OpenAI(GPT-4o), Gemini, Ollama(로컬) 자유 전환
- **AI 채팅 인터페이스** — 자연어로 대화하면서 개발 작업 수행
- **파일 읽기/쓰기** — AI가 파일을 읽고 수정하며, diff 미리보기 후 사용자 승인
- **터미널 실행** — 쉘 명령 실행 (위험 명령어 자동 감지 + 사용자 승인)
- **디렉토리 탐색** — 프로젝트 구조 탐색 (`list_directory`)
- **코드 검색** — 정규식으로 워크스페이스 전체 검색 (`search_code`)
- **채팅 히스토리** — VSCode 재시작해도 대화 내역 유지, Clear 버튼으로 초기화
- **스마트 컨텍스트 관리** — 프로바이더별 차등 임계값으로 할루시네이션 방지
- **API 키 보안 저장** — VSCode SecretStorage 암호화 저장 (코드/파일에 절대 저장 안 함)
- **🛡️ 강화된 에러 처리** — Anthropic 공식 SDK 에러 타입 기반 구분 (인증/레이트 리미트/네트워크 오류)

---

## Requirements

- **VSCode** 1.85 이상
- **Node.js** 18 이상
- **LLM API 키** (사용하는 프로바이더에 맞게 발급)
  - Claude: [Anthropic Console](https://console.anthropic.com)
  - OpenAI: [OpenAI Platform](https://platform.openai.com)
  - Gemini: [Google AI Studio](https://aistudio.google.com)
  - Ollama: API 키 불필요 (로컬 서버)

---

## Installation (개발용)

```bash
# 1. 저장소 클론
git clone https://github.com/cbpark84/vibe-flow.git
cd vibe-flow

# 2. 의존성 설치
npm install

# 3. 전체 빌드
npm run compile
```

---

## Quick Start

### 1. API 키 설정

VSCode 커맨드 팔레트 (Cmd+Shift+P / Ctrl+Shift+P):

```
> Vibe Flow: Set API Key
```

프로바이더를 선택하고 API 키를 입력합니다. VSCode 보안 저장소에 암호화 저장됩니다.

### 2. 채팅 패널 열기

Activity Bar (VSCode 왼쪽 아이콘 바)의 **채팅 버블 아이콘**을 클릭하면 사이드바 안에 채팅 UI가 열립니다.

또는 커맨드 팔레트:

```
> Vibe Flow: Open Chat
```

> **보조 사이드바 사용**: Activity Bar의 Vibe Flow 아이콘을 우클릭 → *"Move to Secondary Side Bar"* 선택,  
> 또는 아이콘을 오른쪽 보조 사이드바로 드래그하면 보조 사이드바에서도 사용할 수 있습니다.

### 3. 프로바이더 선택

채팅 헤더의 드롭다운에서 원하는 AI 프로바이더를 선택합니다.

### 4. 대화 시작

```
"src/index.ts 파일을 읽어줄 수 있어?"
"package.json에 lodash 의존성 추가해줘"
"npm install 실행해줄 수 있어?"
"이 프로젝트 구조 보여줘"
"useState 쓰는 파일 찾아줘"
"ILLMProvider 인터페이스 어디 있어?"
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. 사용자 채팅 입력                                          │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 2. ContextManager — 토큰 초과 시 오래된 대화 자동 트림       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 3. Extension Host → LLM API (도구 정의 포함)                │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
    ┌─────▼─────┐        ┌─────▼──────┐
    │ 텍스트    │        │ 도구 호출  │
    │ 스트리밍  │        │(파일/터미널)│
    └─────┬─────┘        └─────┬──────┘
          │                     │
          │            ┌────────▼────────┐
          │            │ 사용자 승인?    │
          │            │ (미리보기 제시) │
          │            └────────┬────────┘
          └──────────┬──────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ 4. WebView에 스트리밍 (postMessage)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Tools

| 도구 | 설명 | 승인 필요 |
|------|------|---------|
| `read_file` | 파일 내용 읽기 | 아니오 |
| `write_file` | 파일 생성/수정 (diff 미리보기) | **예** |
| `run_terminal` | 쉘 명령 실행 | **예** (위험 패턴 감지) |
| `list_directory` | 디렉토리 구조 탐색 | 아니오 |
| `search_code` | 정규식으로 코드 검색 | 아니오 |

---

## Commands

| 커맨드 | 설명 |
|--------|------|
| `Vibe Flow: Open Chat` | 채팅 패널 열기 |
| `Vibe Flow: Set API Key` | API 키 설정 |
| `Vibe Flow: Clear History` | 채팅 히스토리 초기화 |

---

## Settings

### Workspace Settings (`.vscode/settings.json`)

VSCode의 Workspace 레벨 설정에서 Vibe Flow를 커스터마이징할 수 있습니다:

```json
{
  "vibeflow.defaultProvider": "claude",
  "vibeflow.systemPrompt": "You are an expert developer for this project.",
  "vibeflow.maxTokensPerRequest": 4096
}
```

| 설정 키 | 기본값 | 설명 |
|---------|--------|------|
| `vibeflow.defaultProvider` | `claude` | 기본 LLM 프로바이더 (claude/openai/gemini/ollama) |
| `vibeflow.systemPrompt` | (빈 문자열) | 워크스페이스 커스텀 시스템 프롬프트 |
| `vibeflow.maxTokensPerRequest` | `4096` | 한 번의 요청당 최대 토큰 수 |

### Context Window Management

VSCode `Settings`에서 `Vibe Flow > Context`를 검색하면 프로바이더별 컨텍스트 임계값을 조절할 수 있습니다.

| 설정 키 | 기본값 | 설명 |
|---------|--------|------|
| `vibeflow.context.claude.triggerPercent` | `70` | Claude: 트림 시작 임계값 (%) |
| `vibeflow.context.claude.targetPercent` | `50` | Claude: 트림 후 목표 사용률 (%) |
| `vibeflow.context.openai.triggerPercent` | `65` | OpenAI: 트림 시작 임계값 (%) |
| `vibeflow.context.openai.targetPercent` | `45` | OpenAI: 트림 후 목표 사용률 (%) |
| `vibeflow.context.gemini.triggerPercent` | `75` | Gemini: 트림 시작 임계값 (%) |
| `vibeflow.context.gemini.targetPercent` | `55` | Gemini: 트림 후 목표 사용률 (%) |
| `vibeflow.context.ollama.triggerPercent` | `50` | Ollama: 트림 시작 임계값 (%) |
| `vibeflow.context.ollama.targetPercent` | `30` | Ollama: 트림 후 목표 사용률 (%) |

> **팁**: `triggerPercent`는 항상 `targetPercent`보다 높게 설정하세요.  
> Ollama는 32k 소용량 모델이므로 기본값이 낮게 설정되어 있습니다.

### 프로바이더별 기본 임계값 설계 이유

| 프로바이더 | 컨텍스트 크기 | Trigger | Target | 이유 |
|-----------|-------------|---------|--------|------|
| Claude | 200,000 토큰 | 70% | 50% | 대용량, 여유 있음 |
| OpenAI | 128,000 토큰 | 65% | 45% | 중간 크기 |
| Gemini | 1,000,000 토큰 | 75% | 55% | 초대용량, 가장 여유 |
| Ollama | 32,000 토큰 | 50% | 30% | 소용량, 조기 정리 필수 |

---

## Security

### API 키 보안
- **저장 위치**: VSCode SecretStorage (OS 자격증명 관리자 암호화)
- **코드에 절대 저장 안 함**: 설정 파일이나 소스 코드에 평문 저장 금지
- **읽기 시점**: 채팅 시작 시에만 메모리에 로드

### 위험 명령어 자동 감지 (DANGEROUS_PATTERNS)

터미널 실행 요청 시 다음 패턴 자동 감지 → 사용자에게 경고 표시:

- `rm -rf /`, `rm -rf ~`, `rm -rf *`: 재귀 삭제
- `sudo`, `su`: 관리자 권한 실행
- `chmod 777`, `chown root`: 과도한 권한
- `mkfs.`, `dd if=`: 파일시스템/블록 디바이스 작업
- `curl|sh`, `wget|sh`: 원격 스크립트 즉시 실행
- Fork bomb (`:() { :|:& };:`): 프로세스 폭탄
- `shutdown`, `reboot`, `halt`: 시스템 종료
- `pkill`, `killall -9`: 강제 프로세스 종료
- `npm publish`: 패키지 공개 배포
- `git push --force`: 강제 푸시

**모든 위험 명령어는 사용자 승인 후에만 실행됩니다.**

---

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
npm run lint       # ESLint 검사
npm run format     # Prettier 자동 포매팅
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

---

## Project Structure

```
src/
├── extension.ts                    # Extension Host 진입점
│                                   #   (TOOLS 배열, 도구 실행, postMessage 처리)
├── providers/
│   ├── base.ts                     # ILLMProvider 인터페이스 + 공용 타입
│   ├── claude.ts                   # Claude 프로바이더 (Anthropic SDK)
│   ├── openai.ts                   # OpenAI 프로바이더 (GPT-4o)
│   ├── gemini.ts                   # Gemini 프로바이더 (gemini-1.5-pro)
│   ├── ollama.ts                   # Ollama 프로바이더 (로컬, API 키 불필요)
│   └── factory.ts                  # 프로바이더 팩토리
├── tools/
│   ├── fileSystem.ts               # read_file, write_file, list_directory, search_code
│   └── terminal.ts                 # run_terminal (위험 패턴 차단)
├── webview/
│   ├── main.tsx                    # React 진입점
│   ├── App.tsx                     # 메인 채팅 UI
│   ├── components/
│   │   ├── ChatPanel.tsx           # 채팅 인터페이스
│   │   ├── InputBar.tsx            # 입력창 + 전송/취소 버튼
│   │   ├── MessageBubble.tsx       # 메시지 버블
│   │   ├── ProviderSelector.tsx    # 프로바이더 선택 드롭다운
│   │   └── ToolApproval.tsx        # 파일/터미널 승인 UI
│   └── hooks/
│       ├── useChat.ts              # 채팅 상태 & 메시지 처리
│       └── useVSCode.ts            # VSCode postMessage API 래퍼
└── utils/
    ├── contextManager.ts           # 토큰 관리 (프로바이더별 차등 임계값)
    ├── secretStorage.ts            # API 키 보안 저장/조회
    ├── logger.ts                   # VSCode OutputChannel 래퍼
    └── types.ts                    # WebView ↔ Extension 메시지 타입

esbuild.config.js                   # Extension 빌드 설정
vite.config.ts                      # WebView 빌드 설정
package.json
tsconfig.json
```

---

## Roadmap

| Phase | 상태 | 내용 |
|-------|------|------|
| **Phase 1** | ✅ 완료 | MVP — Claude + 파일 + 터미널 |
| **Phase 2** | ✅ 완료 | 멀티 프로바이더 (OpenAI, Gemini, Ollama) |
| **Phase 3** | ✅ 완료 | 고급 기능 (탐색/검색, 히스토리, 컨텍스트 관리, Diff UI, 워크스페이스 설정) |
| **Phase 4** | 🔄 진행 중 | VSCode 마켓플레이스 배포 (에러 처리 개선, 통합 테스트, 배포 준비) |

### Phase 3 세부 완료 항목
- ✅ `list_directory` — 디렉토리 구조 탐색
- ✅ `search_code` — 정규식 코드 검색
- ✅ 채팅 히스토리 저장/로드 (VSCode globalState)
- ✅ 컨텍스트 윈도우 관리 (exchange 단위 트림, 프로바이더별 차등 임계값)
- ✅ Diff UI 개선 (라인 번호, 헝크 헤더, 변경 통계 포함)
- ✅ 워크스페이스별 설정 (defaultProvider, systemPrompt, maxTokensPerRequest)

### Phase 4 진행 항목 (Step 1: 에러 처리 개선 + UI)
- ✅ Anthropic 공식 SDK 에러 타입 분류 및 사용자 친화적 메시지
- ✅ retry-after 헤더 기반 레이트 리미트 대기 시간 계산
- ✅ 요청 ID 로깅 (API 지원 티켓용)
- ✅ Tool loop 최대 10회 제한 (무한 재시도 방지)
- ✅ 승인 대기 2분 타임아웃 (write_file, run_terminal)
- ✅ Activity Bar 아이콘 표시 (SVG 아이콘 + WebviewViewProvider 전환)
- ✅ 보조 사이드바(Secondary Side Bar) 지원
- ✅ ESLint 0 경고 달성 (TypeScript 반환 타입 어노테이션 완비)

---

## Troubleshooting

### Activity Bar에 아이콘이 보이지 않음
Extension Development Host(F5)로 실행 중인지 확인하세요. 이미 실행 중이라면:
1. 커맨드 팔레트에서 `Developer: Reload Window` 실행
2. Activity Bar에서 Vibe Flow 아이콘 확인
3. 아이콘이 숨겨진 경우 Activity Bar 빈 공간 우클릭 → 목록에서 체크 확인

### "API 키를 등록하세요" 에러
커맨드 팔레트: `Vibe Flow: Set API Key` → 프로바이더 선택 → API 키 입력

### Ollama 연결 안 됨
터미널에서 Ollama 서버 실행:
```bash
ollama serve
```

### "WebView 빌드가 필요합니다" 메시지
```bash
npm run compile:web
```

### 파일을 읽을 수 없음
- 절대 경로 또는 워크스페이스 상대 경로 사용
- 파일 읽기 권한 확인

### 터미널 명령이 실행되지 않음
- 채팅 UI의 "승인" 버튼 클릭 필요
- 위험 패턴 감지 시 경고 표시 후 승인 필요

---

## Contributing

개발 가이드:
- **PLAN.md**: 개발 로드맵 및 아키텍처
- **AGENTS.md**: 코딩 컨벤션 및 에이전트 역할
- **CLAUDE.md**: Claude AI 에이전트 전용 지침

---

## License

MIT License — 자유롭게 사용, 수정, 배포 가능

---

**Last Updated**: 2026-06-26  
**Version**: 0.6.0 (ESLint Clean + Phase 4 Progress)  
**GitHub**: https://github.com/cbpark84/vibe-flow
