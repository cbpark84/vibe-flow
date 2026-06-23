# ARCHITECTURE.md — Vibe Flow VSCode Plugin

**작성일**: 2026-06-24  
**버전**: 2.0  
**대상**: Developer Agent (실제 코드 구현 담당)  
**범위**: Phase 1 MVP + Phase 2 멀티 프로바이더

---

## 1. 전체 파일 목록

아래 파일들은 Phase 1에서 전부 신규 생성해야 한다. 기존 파일 없음.

### Extension Host

| 파일 경로 | 역할 |
|---|---|
| `package.json` | VSCode Extension 매니페스트, npm 스크립트, 의존성 선언 |
| `tsconfig.json` | TypeScript 컴파일러 옵션 (strict mode, Extension Host 대상) |
| `esbuild.config.js` | Extension Host 번들링 스크립트 (src/extension.ts → dist/extension.js) |
| `src/extension.ts` | 플러그인 진입점: activate/deactivate, WebviewPanel 생성, postMessage 라우터 |
| `src/providers/base.ts` | ILLMProvider 인터페이스, ChatMessage, Tool, StreamChunk 타입 정의 |
| `src/providers/claude.ts` | Claude 프로바이더 구현체 (Anthropic SDK 사용, 실제 API 호출) |
| `src/providers/factory.ts` | 프로바이더 이름으로 ILLMProvider 인스턴스를 반환하는 팩토리 함수 |
| `src/tools/types.ts` | ToolDefinition, ToolCallRequest, ToolCallResult 타입 정의 |
| `src/tools/fileSystem.ts` | read_file / write_file / list_directory 도구 구현 (사용자 승인 포함) |
| `src/tools/terminal.ts` | run_terminal 도구 구현 (위험 명령어 필터 + 사용자 승인 게이트) |
| `src/utils/secretStorage.ts` | VSCode SecretStorage 래퍼: getSecret / setSecret / deleteSecret |
| `src/utils/contextManager.ts` | 메시지 히스토리의 토큰 합산 및 오래된 메시지 trim |
| `src/utils/logger.ts` | VSCode OutputChannel 래퍼: info / warn / error |
| `src/utils/types.ts` | WebView ↔ Extension 양방향 postMessage 스키마 타입 전체 정의 |

### WebView UI

| 파일 경로 | 역할 |
|---|---|
| `vite.config.ts` | WebView React 앱 빌드 설정 (출력: dist/webview/) |
| `src/webview/index.html` | WebView HTML 진입점 (CSP 헤더, nonce 자리표시자 포함) |
| `src/webview/main.tsx` | React 18 ReactDOM.createRoot 진입점 |
| `src/webview/App.tsx` | 최상위 컴포넌트: 채팅 레이아웃, postMessage 리스너 등록 |
| `src/webview/components/ChatPanel.tsx` | 메시지 목록 스크롤 컨테이너 |
| `src/webview/components/MessageBubble.tsx` | user / assistant / tool 결과 메시지 렌더링 |
| `src/webview/components/InputBar.tsx` | 텍스트 입력, 전송 버튼, 스트리밍 중 취소 버튼 |
| `src/webview/components/ToolApproval.tsx` | write_file diff 및 run_terminal 명령 승인/거절 UI |
| `src/webview/hooks/useChat.ts` | 채팅 상태(messages, isStreaming) 관리 및 Extension 메시지 연동 |
| `src/webview/hooks/useVSCode.ts` | window.acquireVsCodeApi() 싱글턴 래퍼 |
| `src/webview/styles/globals.css` | Tailwind CSS 기본 import 및 VSCode 테마 색상 변수 |

---

## 2. 기술 스택

```
Extension Host: TypeScript 5.0+ / Node.js 18+ / esbuild 번들링
WebView UI:     React 18 / Vite 5 / Tailwind CSS 3
LLM (Phase 1): @anthropic-ai/sdk (Claude만 구현)
VSCode API:     1.85+ (SecretStorage, WebviewPanel, OutputChannel)
```

---

## 3. ILLMProvider 인터페이스 전체 코드

**파일**: `src/providers/base.ts`

```typescript
/**
 * LLM 메시지의 역할 구분.
 * 'tool' 역할은 도구 실행 결과를 LLM에 돌려줄 때 사용.
 */
export type MessageRole = 'user' | 'assistant' | 'tool';

/**
 * LLM에 전달하는 단일 메시지 구조.
 */
export interface ChatMessage {
  role: MessageRole;
  /**
   * role이 'tool'인 경우 toolCallId와 toolName이 필수.
   * content는 도구 실행 결과 JSON 문자열.
   */
  content: string;
  toolCallId?: string;
  toolName?: string;
}

/**
 * LLM에 전달할 도구 정의 (JSON Schema 기반).
 * Anthropic / OpenAI 양쪽에서 사용 가능한 최소 공통 구조.
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * 스트리밍 청크의 세 가지 종류.
 *
 * - TextChunk:       LLM이 생성한 텍스트 조각
 * - ToolUseChunk:    LLM이 도구 호출을 요청 (id, name, input 포함)
 * - ToolResultChunk: 도구 실행 결과를 LLM에게 피드백 (내부 처리용)
 */
export type StreamChunk =
  | { type: 'text';        content: string }
  | { type: 'tool_use';   toolCallId: string; toolName: string; toolInput: Record<string, unknown> }
  | { type: 'tool_result'; toolCallId: string; content: string; isError: boolean };

/**
 * 모든 LLM 프로바이더가 구현해야 하는 공통 인터페이스.
 *
 * 규칙:
 * - initialize() 호출 전 chat() / countTokens() 호출 시 Error throw.
 * - chat()은 AbortSignal을 통해 외부에서 스트리밍을 취소할 수 있어야 함.
 * - chat()에서 발생한 네트워크/API 에러는 그대로 throw (호출자가 처리).
 */
export interface ILLMProvider {
  /** 화면에 표시될 프로바이더 이름. 예: 'Claude', 'GPT-4' */
  readonly name: string;

  /** 이 프로바이더의 컨텍스트 윈도우 최대 토큰 수. */
  readonly maxTokens: number;

  /**
   * API 클라이언트를 초기화한다.
   * @param apiKey - SecretStorage에서 꺼낸 API 키
   */
  initialize(apiKey: string): Promise<void>;

  /**
   * 스트리밍 채팅을 시작한다.
   * @param messages - 전체 대화 히스토리
   * @param tools    - LLM에 노출할 도구 목록 (없으면 빈 배열)
   * @param signal   - 스트리밍 취소용 AbortSignal
   * @yields StreamChunk — text / tool_use / tool_result 순서로 발행
   */
  chat(
    messages: ChatMessage[],
    tools?: Tool[],
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk>;

  /**
   * 주어진 텍스트의 토큰 수를 추정한다.
   * 정확한 카운팅 API가 없는 경우 1 token ≈ 4 chars 근사값 사용.
   */
  countTokens(text: string): Promise<number>;
}
```

---

## 4. postMessage 스키마 전체 코드

**파일**: `src/utils/types.ts`

이 파일의 타입을 WebView와 Extension Host 양쪽에서 동시에 import하여 타입 안전성을 확보한다.  
WebView에서는 `vite.config.ts`의 alias를 통해 동일 경로로 접근한다.

```typescript
// ─────────────────────────────────────────────────────────────
// WebView → Extension 메시지 (WebView가 발송, Extension이 수신)
// ─────────────────────────────────────────────────────────────

/** 사용자가 채팅 메시지를 전송할 때 */
export interface WVMsg_SendChat {
  type: 'chat_send';
  payload: {
    message: string;
    /** 채팅에 첨부할 파일 경로 목록 (없으면 빈 배열) */
    attachedFiles: string[];
  };
}

/** 스트리밍 중 사용자가 취소 버튼을 누를 때 */
export interface WVMsg_AbortStream {
  type: 'chat_abort';
}

/** 사용자가 write_file 승인 요청에 응답할 때 */
export interface WVMsg_ApproveWriteFile {
  type: 'approve_write_file';
  payload: {
    /** Extension이 발행했던 요청과 매칭하는 ID */
    requestId: string;
    approved: boolean;
  };
}

/** 사용자가 run_terminal 승인 요청에 응답할 때 */
export interface WVMsg_ApproveRunTerminal {
  type: 'approve_run_terminal';
  payload: {
    requestId: string;
    approved: boolean;
  };
}

/** API 키를 SecretStorage에 저장할 때 */
export interface WVMsg_SaveApiKey {
  type: 'save_api_key';
  payload: {
    provider: string;   // 예: 'claude'
    apiKey: string;
  };
}

/** API 키 존재 여부 확인 요청 */
export interface WVMsg_CheckApiKey {
  type: 'check_api_key';
  payload: {
    provider: string;
  };
}

/** 모든 WebView → Extension 메시지의 유니온 타입 */
export type WebviewToExtMessage =
  | WVMsg_SendChat
  | WVMsg_AbortStream
  | WVMsg_ApproveWriteFile
  | WVMsg_ApproveRunTerminal
  | WVMsg_SaveApiKey
  | WVMsg_CheckApiKey;


// ─────────────────────────────────────────────────────────────
// Extension → WebView 메시지 (Extension이 발송, WebView가 수신)
// ─────────────────────────────────────────────────────────────

/** LLM이 생성한 텍스트 청크 (스트리밍 중) */
export interface ExtMsg_StreamChunk {
  type: 'stream_chunk';
  payload: {
    content: string;
  };
}

/** 스트리밍이 정상 완료됨 */
export interface ExtMsg_StreamEnd {
  type: 'stream_end';
}

/** 스트리밍 중 에러 발생 (API 오류, 네트워크 등) */
export interface ExtMsg_StreamError {
  type: 'stream_error';
  payload: {
    message: string;
  };
}

/** write_file 승인 요청: diff 포함 */
export interface ExtMsg_RequestWriteFile {
  type: 'request_write_file';
  payload: {
    requestId: string;
    filePath: string;
    /** unified diff 형식 문자열 */
    diff: string;
    /** 파일이 신규 생성인지 여부 */
    isNewFile: boolean;
  };
}

/** run_terminal 승인 요청: 명령어 포함 */
export interface ExtMsg_RequestRunTerminal {
  type: 'request_run_terminal';
  payload: {
    requestId: string;
    command: string;
    /** 위험 명령어 탐지 여부 */
    isDangerous: boolean;
    /** 감지된 위험 패턴 설명 (isDangerous=true 시 필수) */
    dangerReason?: string;
  };
}

/** write_file 또는 run_terminal 도구 실행 완료 결과 */
export interface ExtMsg_ToolResult {
  type: 'tool_result';
  payload: {
    requestId: string;
    toolName: 'write_file' | 'run_terminal';
    success: boolean;
    /** 터미널 실행 stdout+stderr 또는 에러 메시지 */
    output?: string;
  };
}

/** API 키 확인 결과 응답 */
export interface ExtMsg_ApiKeyStatus {
  type: 'api_key_status';
  payload: {
    provider: string;
    exists: boolean;
  };
}

/** 일반 에러 알림 (스트리밍과 무관한 에러) */
export interface ExtMsg_Error {
  type: 'error';
  payload: {
    message: string;
    code?: string;
  };
}

/** 모든 Extension → WebView 메시지의 유니온 타입 */
export type ExtensionToWebviewMessage =
  | ExtMsg_StreamChunk
  | ExtMsg_StreamEnd
  | ExtMsg_StreamError
  | ExtMsg_RequestWriteFile
  | ExtMsg_RequestRunTerminal
  | ExtMsg_ToolResult
  | ExtMsg_ApiKeyStatus
  | ExtMsg_Error;
```

---

## 5. run_terminal 안전장치 설계

**파일**: `src/tools/terminal.ts`

### 5.1 위험 명령어 패턴 목록

Extension Host에서 정적으로 정의하며, 대소문자 무관하게 매칭한다.

```typescript
// src/tools/terminal.ts 내 상수
const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /rm\s+-rf?\s+[\/~]/, reason: 'rm -rf: 루트/홈 하위 재귀 삭제' },
  { pattern: /rm\s+-rf?\s+\*/, reason: 'rm -rf *: 와일드카드 재귀 삭제' },
  { pattern: /\bsudo\b/,        reason: 'sudo: 관리자 권한 실행' },
  { pattern: /\bsu\b/,          reason: 'su: 사용자 전환' },
  { pattern: /chmod\s+[0-7]*7[0-7][0-7]/, reason: 'chmod 777급: 과도한 권한 부여' },
  { pattern: /chown\s+root/,    reason: 'chown root: 소유권 변경' },
  { pattern: /mkfs\./,          reason: 'mkfs: 파일시스템 포맷' },
  { pattern: /dd\s+if=/,        reason: 'dd: 블록 디바이스 덮어쓰기' },
  { pattern: />\s*\/dev\/sd/,   reason: '블록 디바이스 직접 쓰기' },
  { pattern: /curl[^|]*\|\s*(ba)?sh/, reason: 'curl pipe sh: 원격 스크립트 즉시 실행' },
  { pattern: /wget[^|]*\|\s*(ba)?sh/, reason: 'wget pipe sh: 원격 스크립트 즉시 실행' },
  { pattern: /:(){ :|:& };:/, reason: 'Fork bomb: 프로세스 폭탄' },
  { pattern: /shutdown|reboot|halt/, reason: '시스템 종료/재시작' },
  { pattern: /pkill|killall\s+-9/, reason: 'killall -9: 강제 프로세스 종료' },
  { pattern: /npm\s+publish/,   reason: 'npm publish: 패키지 공개 배포' },
  { pattern: /git\s+push\s+.*--force/, reason: 'git push --force: 강제 푸시' },
];
```

> 위험 패턴에 해당하더라도 실행 자체는 사용자 승인 여부에 달려 있다.  
> 위험 패턴 미감지 명령어도 항상 사용자 승인을 거친다 (Phase 1 정책).

### 5.2 승인 흐름 다이어그램

```
LLM (Claude)
  │
  │ StreamChunk { type: 'tool_use', toolName: 'run_terminal', toolInput: { command } }
  ▼
Extension Host (src/tools/terminal.ts)
  │
  ├─ 위험 패턴 검사 (DANGEROUS_PATTERNS)
  │
  ├─ panel.webview.postMessage({
  │    type: 'request_run_terminal',
  │    payload: { requestId, command, isDangerous, dangerReason? }
  │  })
  │
  ▼
WebView (ToolApproval.tsx)
  │  사용자에게 명령어 표시
  │  isDangerous=true면 붉은 경고 배너 표시
  │
  ├─ [승인 클릭] → postMessage({ type: 'approve_run_terminal', payload: { requestId, approved: true } })
  └─ [거절 클릭] → postMessage({ type: 'approve_run_terminal', payload: { requestId, approved: false } })
  │
  ▼
Extension Host (src/extension.ts 라우터)
  │
  ├─ approved: false → tool_result(success: false, output: '사용자가 거절') → LLM에 전달
  │
  └─ approved: true
       │
       ├─ child_process.exec(command, { signal: AbortSignal })
       │  stdout/stderr → panel.webview.postMessage({ type: 'stream_chunk' }) 실시간 전송
       │
       └─ 완료 또는 에러 → panel.webview.postMessage({ type: 'tool_result', ... })
                                → LLM에 tool_result 피드백 후 다음 응답 생성
```

### 5.3 AbortSignal 연동

- `chat_abort` 메시지 수신 시 Extension이 보유한 `AbortController.abort()` 호출.
- `terminal.ts`는 `AbortSignal`을 `child_process.exec` 옵션에 넘겨 프로세스 강제 종료.
- AbortError 발생 시 `tool_result(success: false, output: '사용자가 중단')` 반환.

---

## 6. write_file 승인 흐름

**파일**: `src/tools/fileSystem.ts`

### 6.1 전체 흐름

```
LLM (Claude)
  │
  │ StreamChunk { type: 'tool_use', toolName: 'write_file',
  │               toolInput: { filePath, content } }
  ▼
Extension Host (src/tools/fileSystem.ts)
  │
  ├─ 기존 파일 읽기 (없으면 isNewFile = true)
  ├─ diff 생성: createTwoFilesPatch(originalContent, newContent)
  │   → unified diff 형식 문자열
  │
  ├─ panel.webview.postMessage({
  │    type: 'request_write_file',
  │    payload: { requestId, filePath, diff, isNewFile }
  │  })
  │
  ▼
WebView (ToolApproval.tsx)
  │  diff를 코드 블록으로 시각화 (추가: 초록, 삭제: 빨강)
  │  파일 경로 및 isNewFile 여부 표시
  │
  ├─ [승인] → postMessage({ type: 'approve_write_file', payload: { requestId, approved: true } })
  └─ [거절] → postMessage({ type: 'approve_write_file', payload: { requestId, approved: false } })
  │
  ▼
Extension Host (src/extension.ts 라우터)
  │
  ├─ approved: false → tool_result(success: false) → LLM 피드백
  │
  └─ approved: true
       ├─ fs.mkdir(dirname, { recursive: true })  // 디렉토리 자동 생성
       ├─ fs.writeFile(filePath, content, 'utf-8')
       └─ tool_result(success: true) → LLM 피드백
```

### 6.2 diff 생성 라이브러리

`diff` 패키지 (`npm install diff @types/diff`)의 `createTwoFilesPatch` 함수 사용.  
신규 파일인 경우 originalContent = '' (빈 문자열)로 처리.

---

## 7. 핵심 컴포넌트 동작 설명

### 7.1 src/extension.ts — postMessage 라우터

activate() 함수에서 WebviewPanel을 생성하고 `onDidReceiveMessage` 핸들러를 등록한다.  
핸들러는 `WebviewToExtMessage`의 `type` 필드로 분기하며, 각 케이스에서 해당 도구/유틸 함수를 호출한다.

```
activate()
├── createWebviewPanel()
├── 현재 프로바이더 인스턴스 (ILLMProvider) 보관
├── onDidReceiveMessage 라우터
│   ├── 'chat_send'             → claudeProvider.chat() 시작, StreamChunk를 postMessage로 중계
│   ├── 'chat_abort'            → AbortController.abort()
│   ├── 'approve_write_file'    → fileSystem.ts의 대기 중인 Promise resolve
│   ├── 'approve_run_terminal'  → terminal.ts의 대기 중인 Promise resolve
│   ├── 'save_api_key'          → secretStorage.setSecret()
│   └── 'check_api_key'         → secretStorage.getSecret() → 결과 postMessage
└── deactivate() → AbortController.abort(), 리소스 정리
```

**승인 대기 패턴**: write_file / run_terminal은 `Map<requestId, { resolve, reject }>` 구조로 대기한다.  
WebView에서 승인/거절 응답이 오면 해당 requestId의 Promise를 resolve/reject한다.

### 7.2 src/providers/claude.ts

Phase 1에서는 Claude 프로바이더만 구현하며, `ILLMProvider`를 완전히 구현해야 한다.

- `initialize()`: `new Anthropic({ apiKey })` 저장
- `chat()`: `client.messages.stream()` 사용, `on('text', chunk => yield)` 패턴
- 도구 결과가 오면 tool_result 메시지를 추가하여 재귀적으로 API 재호출 (tool_use 루프)
- 모델: `claude-opus-4-5` (배포 전 최신 모델로 업데이트 필요, CLAUDE.md 참고)

### 7.3 src/utils/contextManager.ts

```
ContextManager.trim(messages: ChatMessage[], maxTokens: number): ChatMessage[]
```

- system 메시지는 항상 보존
- 오래된 user/assistant 메시지 쌍부터 제거
- 각 메시지의 content를 `provider.countTokens()`로 합산
- 총합이 maxTokens * 0.8 이하가 될 때까지 반복 제거

---

## 8. 디렉토리 구조

```
cc_플러그인_개발/
├── src/
│   ├── extension.ts
│   ├── providers/
│   │   ├── base.ts
│   │   ├── claude.ts
│   │   ├── factory.ts
│   │   ├── openai.ts          # Phase 2 신규
│   │   ├── gemini.ts          # Phase 2 신규
│   │   └── ollama.ts          # Phase 2 신규
│   ├── tools/
│   │   ├── types.ts
│   │   ├── fileSystem.ts
│   │   └── terminal.ts
│   ├── utils/
│   │   ├── types.ts
│   │   ├── secretStorage.ts
│   │   ├── contextManager.ts
│   │   └── logger.ts
│   └── webview/
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── ChatPanel.tsx
│       │   ├── MessageBubble.tsx
│       │   ├── InputBar.tsx
│       │   ├── ToolApproval.tsx
│       │   └── ProviderSelector.tsx  # Phase 2 신규
│       ├── hooks/
│       │   ├── useChat.ts
│       │   └── useVSCode.ts
│       └── styles/
│           └── globals.css
├── dist/
│   ├── extension.js
│   └── webview/
│       ├── index.html
│       └── assets/
├── .vscode/
│   └── launch.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── esbuild.config.js
├── .eslintrc.json
├── .prettierrc
└── ARCHITECTURE.md
```

---

## 9. package.json 주요 의존성

```json
{
  "name": "vibe-flow",
  "displayName": "Vibe Flow",
  "description": "AI-powered coding assistant for VSCode",
  "version": "0.1.0",
  "engines": { "vscode": "^1.85.0" },
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "vibeflow.openChat",
        "title": "Vibe Flow: Open Chat"
      },
      {
        "command": "vibeflow.setApiKey",
        "title": "Vibe Flow: Set API Key"
      }
    ],
    "viewsContainers": {
      "activitybar": [
        {
          "id": "vibeflow-sidebar",
          "title": "Vibe Flow",
          "icon": "$(comment-discussion)"
        }
      ]
    }
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "diff": "^5.2.0"
  },
  "devDependencies": {
    "@types/diff": "^5.2.1",
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@types/vscode": "^1.85.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "esbuild": "^0.21.0",
    "eslint": "^8.57.0",
    "postcss": "^8.4.0",
    "prettier": "^3.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.3.0"
  }
}
```

### 주요 버전 선택 이유

| 패키지 | 버전 | 이유 |
|---|---|---|
| `@anthropic-ai/sdk` | `^0.30.0` | Streaming + Tool Use 안정 지원 |
| `diff` | `^5.2.0` | `createTwoFilesPatch` unified diff 생성 |
| `vscode` | `^1.85.0` | SecretStorage API 안정화 버전 |
| `react` | `^18.3.0` | createRoot + concurrent features |
| `esbuild` | `^0.21.0` | Extension Host CJS 번들링 |
| `vite` | `^5.3.0` | WebView ESM 번들링 |

---

## 10. 빌드 명령어

### npm scripts (package.json에 등록)

```json
"scripts": {
  "compile:ext":  "node esbuild.config.js",
  "compile:web":  "vite build",
  "compile":      "npm run compile:ext && npm run compile:web",
  "watch:ext":    "node esbuild.config.js --watch",
  "watch:web":    "vite build --watch",
  "lint":         "eslint src --ext .ts,.tsx",
  "format":       "prettier --write src/**/*.{ts,tsx,css}",
  "package":      "vsce package"
}
```

### esbuild.config.js 핵심 설정

```javascript
// esbuild.config.js
const { build } = require('esbuild');

const watch = process.argv.includes('--watch');

build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  external: ['vscode'],        // VSCode는 번들에 포함 안 함
  format: 'cjs',               // Extension Host는 CommonJS
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  minify: !watch,
  watch: watch ? { onRebuild: (err) => { if (err) console.error(err); } } : false,
});
```

### vite.config.ts 핵심 설정

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/webview',
  build: {
    outDir: '../../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/webview/index.html',
    },
  },
  resolve: {
    alias: {
      // Extension Host의 shared types를 WebView에서 동일 경로로 import
      '@shared': path.resolve(__dirname, 'src/utils'),
    },
  },
});
```

WebView에서 shared types import 예시:
```typescript
import type { ExtensionToWebviewMessage } from '@shared/types';
```

---

## 11. tsconfig.json 핵심 설정

Extension Host와 WebView는 빌드 도구가 다르므로 tsconfig는 Extension Host 전용으로 작성하고, WebView는 Vite가 자체 처리한다.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["src/webview", "node_modules", "dist"]
}
```

---

## 12. 주요 설계 결정 및 제약사항

| 결정 | 내용 | 이유 |
|---|---|---|
| run_terminal 기본 정책 | 위험 여부 무관, 항상 사용자 승인 필요 | Phase 1 안전 우선 정책 |
| write_file diff | `diff` 패키지의 unified diff | 구현 간단, 표준 형식 |
| 승인 대기 구조 | `Map<requestId, Promise>` | 여러 도구 요청을 동시에 처리 가능 |
| WebView CSP | `script-src 'nonce-{nonce}'` | VSCode 권장 보안 정책 |
| 스트리밍 재개 불가 | AbortSignal 취소 후 재전송은 새 대화로 처리 | 복잡성 최소화 (YAGNI) |
| Phase 1 프로바이더 | Claude만 구현 | MVP 범위 준수 |
| list_directory 보안 | 워크스페이스 루트 밖 경로 차단 | 경로 이스케이프 방지 |

---

## 13. Developer Agent를 위한 구현 순서 권고

Phase 1 구현 시 아래 순서를 따르면 의존성 충돌 없이 진행할 수 있다.

```
1. package.json, tsconfig.json, esbuild.config.js, vite.config.ts 생성 (빌드 환경)
2. src/utils/types.ts (postMessage 스키마 — 양측 공유)
3. src/providers/base.ts (ILLMProvider 인터페이스)
4. src/tools/types.ts (ToolDefinition 등)
5. src/utils/logger.ts, secretStorage.ts (유틸)
6. src/utils/contextManager.ts (유틸)
7. src/providers/claude.ts (실제 API 연동)
8. src/providers/factory.ts
9. src/tools/fileSystem.ts
10. src/tools/terminal.ts
11. src/extension.ts (위 모두 완성 후 라우터 구현)
12. src/webview/hooks/useVSCode.ts, useChat.ts
13. src/webview/components/* (UI)
14. src/webview/App.tsx, main.tsx, index.html
15. npm run compile 및 F5 디버그 실행 확인
```

---

## Phase 2: 멀티 프로바이더

**추가일**: 2026-06-24  
**버전**: 2.0  
**범위**: OpenAI / Gemini / Ollama 프로바이더 추가, 프로바이더 선택 UI, API 키 개별 관리

---

### P2-1. 프로바이더 스펙표

| 프로바이더 | secretStorage 키 | 기본 모델 | maxTokens | API 키 필요 |
|---|---|---|---|---|
| claude | `claude-api-key` | `claude-opus-4-5` | 200,000 | 필요 |
| openai | `openai-api-key` | `gpt-4o` | 128,000 | 필요 |
| gemini | `gemini-api-key` | `gemini-1.5-pro` | 1,000,000 | 필요 |
| ollama | (없음) | `llama3.2` | 32,000 | 불필요 |

**Ollama 특이사항**: 로컬 HTTP 서버(`http://localhost:11434`)에 요청하므로 API 키가 없다.  
`initialize(apiKey: string)` 시그니처는 유지하되 apiKey 인자를 무시하고 빈 문자열로 호출한다.

---

### P2-2. 신규 파일 목록 및 역할

| 파일 | 역할 |
|---|---|
| `src/providers/openai.ts` | OpenAI SDK(`openai` 패키지) 기반 프로바이더. gpt-4o 스트리밍 + Function Calling |
| `src/providers/gemini.ts` | Google SDK(`@google/generative-ai` 패키지) 기반 프로바이더. gemini-1.5-pro 스트리밍 |
| `src/providers/ollama.ts` | Ollama REST API(`fetch` 기반) 프로바이더. API 키 불필요, 로컬 전용 |
| `src/webview/components/ProviderSelector.tsx` | 헤더에 위치하는 프로바이더 드롭다운 + 현재 모델명 표시 |

---

### P2-3. package.json 추가 의존성

Phase 2에서 `dependencies`에 아래 패키지를 추가한다.

```json
"dependencies": {
  "@anthropic-ai/sdk": "^0.30.0",
  "@google/generative-ai": "^0.21.0",
  "diff": "^5.2.0",
  "openai": "^4.67.0"
}
```

**Ollama는 별도 패키지 없음**: 공식 REST API를 Node.js 내장 `fetch`로 직접 호출한다.  
(`ollama` npm 패키지는 존재하나 YAGNI 원칙에 따라 미사용.)

---

### P2-4. factory.ts 변경 설계

`createProvider()`가 네 가지 프로바이더 이름을 지원하도록 확장한다.  
기존 호출부(`extension.ts`)의 시그니처는 변경되지 않는다.

```typescript
// src/providers/factory.ts

import { ILLMProvider } from './base';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';   // Phase 2 추가
import { GeminiProvider } from './gemini';   // Phase 2 추가
import { OllamaProvider } from './ollama';   // Phase 2 추가

export type ProviderKey = 'claude' | 'openai' | 'gemini' | 'ollama';

export function createProvider(providerName: string): ILLMProvider {
  const name = providerName.toLowerCase() as ProviderKey;

  switch (name) {
    case 'claude': return new ClaudeProvider();
    case 'openai': return new OpenAIProvider();
    case 'gemini': return new GeminiProvider();
    case 'ollama': return new OllamaProvider();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
```

---

### P2-5. 각 프로바이더 구현 명세

#### P2-5-1. OpenAI (`src/providers/openai.ts`)

```typescript
import OpenAI from 'openai';
import { ILLMProvider, ChatMessage, Tool, StreamChunk } from './base';

export class OpenAIProvider implements ILLMProvider {
  private client!: OpenAI;

  readonly name = 'OpenAI';
  readonly maxTokens = 128_000;

  async initialize(apiKey: string): Promise<void> {
    // Phase 2: openai 패키지 초기화
    this.client = new OpenAI({ apiKey });
  }

  async *chat(
    messages: ChatMessage[],
    tools: Tool[] = [],
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk> {
    // 1. ChatMessage[] → OpenAI ChatCompletionMessageParam[] 변환
    //    - role 'tool' → role 'tool' (OpenAI 형식과 동일)
    //    - toolCallId, toolName 필드를 OpenAI tool_call_id, name 필드로 매핑
    // 2. Tool[] → OpenAI ChatCompletionTool[] 변환
    //    - inputSchema → parameters (동일 JSON Schema 구조)
    // 3. client.chat.completions.create({ stream: true, ... }) 호출
    // 4. delta.content → { type: 'text', content } yield
    // 5. delta.tool_calls → { type: 'tool_use', toolCallId, toolName, toolInput } yield
    //    (tool_calls는 청크에 걸쳐 조각으로 오므로 accumulate 후 완성 시 yield)
  }

  async countTokens(text: string): Promise<number> {
    // OpenAI는 공개 토큰 카운팅 API 없음 → 1 token ≈ 4 chars 근사값 사용
    return Math.ceil(text.length / 4);
  }
}
```

**OpenAI tool_calls 누적 주의사항**:  
스트리밍 시 `delta.tool_calls`는 index별로 쪼개져 전달된다.  
`Map<index, { id, name, argumentsBuffer }>` 구조로 누적하다가 `finish_reason === 'tool_calls'`가 오면 파싱하여 yield한다.

#### P2-5-2. Gemini (`src/providers/gemini.ts`)

```typescript
import {
  GoogleGenerativeAI,
  FunctionDeclaration,
  Tool as GeminiTool,
} from '@google/generative-ai';
import { ILLMProvider, ChatMessage, Tool, StreamChunk } from './base';

export class GeminiProvider implements ILLMProvider {
  private client!: GoogleGenerativeAI;

  readonly name = 'Gemini';
  readonly maxTokens = 1_000_000;

  async initialize(apiKey: string): Promise<void> {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async *chat(
    messages: ChatMessage[],
    tools: Tool[] = [],
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk> {
    // 1. 메시지 변환: ChatMessage[] → Gemini Content[] 형식
    //    - role 'user'      → { role: 'user', parts: [{ text }] }
    //    - role 'assistant' → { role: 'model', parts: [{ text }] }
    //    - role 'tool'      → { role: 'user', parts: [{ functionResponse: { name, response } }] }
    // 2. Tool[] → FunctionDeclaration[] 변환
    //    - inputSchema.properties → parameters.properties
    // 3. model.generateContentStream() 호출
    // 4. chunk.text() → { type: 'text', content } yield
    // 5. functionCalls() → { type: 'tool_use', ... } yield
  }

  async countTokens(text: string): Promise<number> {
    // Gemini SDK는 countTokens() API 제공하나 추가 네트워크 호출 발생
    // Phase 2에서는 근사값 사용 (Phase 3에서 정확한 카운팅으로 업그레이드 가능)
    return Math.ceil(text.length / 4);
  }
}
```

**Gemini 역할 변환 규칙**:  
Gemini API는 `role`이 `'user'` 또는 `'model'`만 허용한다.  
`tool` 역할 메시지(함수 실행 결과)는 `role: 'user'`에 `functionResponse` parts로 변환한다.

#### P2-5-3. Ollama (`src/providers/ollama.ts`)

```typescript
import { ILLMProvider, ChatMessage, Tool, StreamChunk } from './base';

const OLLAMA_BASE_URL = 'http://localhost:11434';

export class OllamaProvider implements ILLMProvider {
  readonly name = 'Ollama';
  readonly maxTokens = 32_000;

  // Ollama는 API 키 불필요 — initialize()는 no-op
  async initialize(_apiKey: string): Promise<void> {}

  async *chat(
    messages: ChatMessage[],
    tools: Tool[] = [],
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk> {
    // 1. ChatMessage[] → Ollama /api/chat 형식으로 변환
    //    { role: 'user'|'assistant'|'tool', content: string }
    // 2. Tool[] → Ollama tools 배열 형식으로 변환 (OpenAI 형식과 유사)
    // 3. fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    //      method: 'POST',
    //      body: JSON.stringify({ model: 'llama3.2', messages, tools, stream: true }),
    //      signal
    //    })
    // 4. ReadableStream을 줄 단위(NDJSON)로 파싱
    //    - message.content → { type: 'text', content } yield
    //    - message.tool_calls → { type: 'tool_use', ... } yield
  }

  async countTokens(text: string): Promise<number> {
    // Ollama는 토큰 카운팅 엔드포인트 없음 → 1 token ≈ 4 chars
    return Math.ceil(text.length / 4);
  }
}
```

**Ollama 연결 실패 처리**:  
`fetch`가 `ECONNREFUSED`를 던지면 `'Ollama가 실행 중이지 않습니다. ollama serve 명령으로 시작하세요.'` 메시지로 변환하여 throw한다.  
이 에러는 `extension.ts`의 `handleChatSend` catch 블록에서 `stream_error`로 WebView에 전달된다.

---

### P2-6. utils/types.ts 추가 메시지 타입

Phase 2에서 `src/utils/types.ts`에 아래 타입을 추가한다.  
기존 타입은 변경하지 않으며, 유니온 타입에 새 멤버만 추가한다.

```typescript
// ─────────────────────────────────────────────────────────────
// Phase 2 추가: 프로바이더 관련 메시지
// ─────────────────────────────────────────────────────────────

/** WebView → Extension: 사용자가 프로바이더 드롭다운에서 항목을 선택했을 때 */
export interface WVMsg_SelectProvider {
  type: 'select_provider';
  payload: {
    /** 'claude' | 'openai' | 'gemini' | 'ollama' */
    provider: string;
  };
}

/** WebView → Extension: 플러그인 초기화 시 현재 프로바이더 목록 요청 */
export interface WVMsg_GetProviderList {
  type: 'get_provider_list';
}

/** Extension → WebView: 프로바이더 전환 완료 알림 */
export interface ExtMsg_ProviderChanged {
  type: 'provider_changed';
  payload: {
    /** 새로 활성화된 프로바이더 키. 예: 'openai' */
    provider: string;
    /** 화면에 표시할 모델명. 예: 'gpt-4o' */
    modelName: string;
  };
}

/** 프로바이더 목록 항목 */
export interface ProviderInfo {
  /** 내부 식별자. 예: 'claude' */
  key: string;
  /** 화면 표시 이름. 예: 'Claude' */
  displayName: string;
  /** 현재 사용 모델명. 예: 'claude-opus-4-5' */
  modelName: string;
  /** API 키 필요 여부 (Ollama = false) */
  requiresApiKey: boolean;
}

/** Extension → WebView: 사용 가능한 프로바이더 전체 목록 전송 */
export interface ExtMsg_ProviderList {
  type: 'provider_list';
  payload: {
    providers: ProviderInfo[];
    /** 현재 활성 프로바이더 키 */
    activeProvider: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Phase 2: 유니온 타입 확장
// ─────────────────────────────────────────────────────────────

/** Phase 2 확장된 WebView → Extension 유니온 */
export type WebviewToExtMessage =
  | WVMsg_SendChat
  | WVMsg_AbortStream
  | WVMsg_ApproveWriteFile
  | WVMsg_ApproveRunTerminal
  | WVMsg_SaveApiKey
  | WVMsg_CheckApiKey
  | WVMsg_SelectProvider       // Phase 2 추가
  | WVMsg_GetProviderList;     // Phase 2 추가

/** Phase 2 확장된 Extension → WebView 유니온 */
export type ExtensionToWebviewMessage =
  | ExtMsg_StreamChunk
  | ExtMsg_StreamEnd
  | ExtMsg_StreamError
  | ExtMsg_RequestWriteFile
  | ExtMsg_RequestRunTerminal
  | ExtMsg_ToolResult
  | ExtMsg_ApiKeyStatus
  | ExtMsg_Error
  | ExtMsg_ProviderChanged     // Phase 2 추가
  | ExtMsg_ProviderList;       // Phase 2 추가
```

---

### P2-7. extension.ts 변경 설계

Phase 2에서 `src/extension.ts`에 아래 변경이 필요하다. 기존 로직은 최소한으로만 수정한다.

#### P2-7-1. 모듈 레벨 상태 추가

```typescript
// Phase 2 추가: 현재 활성 프로바이더 키 (기본값: 'claude')
let activeProviderKey: string = 'claude';
```

#### P2-7-2. handleChatSend 수정

기존에 `createProvider('claude')`를 하드코딩했던 부분을 `activeProviderKey`로 교체한다.

```typescript
// Before (Phase 1)
provider = createProvider('claude');
const apiKey = await getSecret('claude-api-key');

// After (Phase 2)
provider = createProvider(activeProviderKey);
const secretKey = `${activeProviderKey}-api-key`;
// Ollama는 API 키 불필요 — getSecret이 undefined를 반환하면 빈 문자열로 처리
const apiKey = (await getSecret(secretKey)) ?? '';

if (activeProviderKey !== 'ollama' && !apiKey) {
  sendMessage({
    type: 'error',
    payload: { message: `${activeProviderKey} API 키가 설정되지 않았습니다.` },
  });
  return;
}
await provider.initialize(apiKey);
```

#### P2-7-3. handleWebviewMessage 라우터 케이스 추가

```typescript
case 'select_provider': {
  await handleSelectProvider(message.payload.provider);
  break;
}
case 'get_provider_list': {
  sendMessage({
    type: 'provider_list',
    payload: {
      providers: PROVIDER_LIST,
      activeProvider: activeProviderKey,
    },
  });
  break;
}
```

#### P2-7-4. handleSelectProvider 함수 추가

```typescript
// src/extension.ts 내 신규 함수

const PROVIDER_LIST: ProviderInfo[] = [
  { key: 'claude', displayName: 'Claude',  modelName: 'claude-opus-4-5', requiresApiKey: true  },
  { key: 'openai', displayName: 'OpenAI',  modelName: 'gpt-4o',          requiresApiKey: true  },
  { key: 'gemini', displayName: 'Gemini',  modelName: 'gemini-1.5-pro',  requiresApiKey: true  },
  { key: 'ollama', displayName: 'Ollama',  modelName: 'llama3.2',        requiresApiKey: false },
];

async function handleSelectProvider(providerKey: string): Promise<void> {
  const info = PROVIDER_LIST.find(p => p.key === providerKey);
  if (!info) {
    sendMessage({ type: 'error', payload: { message: `Unknown provider: ${providerKey}` } });
    return;
  }

  // API 키 필요한 프로바이더인데 키가 없으면 → WebView에 키 요청
  if (info.requiresApiKey) {
    const apiKey = await getSecret(`${providerKey}-api-key`);
    if (!apiKey) {
      // WebView의 api_key_status 핸들러가 save_api_key 입력 UI를 열도록 알림
      sendMessage({
        type: 'api_key_status',
        payload: { provider: providerKey, exists: false },
      });
      return; // 키 저장 완료 후 사용자가 다시 선택해야 함
    }
  }

  // 프로바이더 전환 — provider 인스턴스를 초기화하지 않고 null로만 설정
  // 다음 chat_send 시 새 프로바이더로 초기화됨 (lazy init 유지)
  activeProviderKey = providerKey;
  provider = null;

  sendMessage({
    type: 'provider_changed',
    payload: { provider: providerKey, modelName: info.modelName },
  });

  logger.info(`Provider switched to: ${providerKey}`);
}
```

---

### P2-8. ProviderSelector 컴포넌트 설계

**파일**: `src/webview/components/ProviderSelector.tsx`

```typescript
import React from 'react';

export interface ProviderSelectorProps {
  providers: Array<{
    key: string;
    displayName: string;
    modelName: string;
  }>;
  activeProvider: string;
  isStreaming: boolean;
  onSelect: (providerKey: string) => void;
}

export default function ProviderSelector({
  providers,
  activeProvider,
  isStreaming,
  onSelect,
}: ProviderSelectorProps) {
  const active = providers.find(p => p.key === activeProvider);

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeProvider}
        disabled={isStreaming}  // 스트리밍 중 전환 금지
        onChange={(e) => onSelect(e.target.value)}
        className="text-sm bg-transparent border border-gray-400 dark:border-gray-600
                   rounded px-2 py-1 focus:outline-none"
        aria-label="AI Provider"
      >
        {providers.map((p) => (
          <option key={p.key} value={p.key}>
            {p.displayName}
          </option>
        ))}
      </select>
      {active && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {active.modelName}
        </span>
      )}
    </div>
  );
}
```

**배치**: `App.tsx`의 `<header>` 내부, 기존 타이틀 우측에 추가한다.

---

### P2-9. App.tsx 변경 설계

`useChat` 훅에서 프로바이더 상태를 함께 관리하도록 확장하거나,  
`App.tsx`에서 직접 `ProviderSelector`에 필요한 상태를 관리한다.

**선택**: `useChat.ts`에 프로바이더 상태를 추가하는 방식 (응집도 유지).

#### P2-9-1. useChat.ts 반환값 추가

```typescript
// useChat.ts에서 추가로 반환할 값
return {
  messages,
  isStreaming,
  sendMessage,
  cancelStreaming,
  approveWriteFile,
  approveRunTerminal,
  // Phase 2 추가
  providers,            // ProviderInfo[]
  activeProvider,       // string
  selectProvider,       // (key: string) => void
};
```

#### P2-9-2. useChat.ts 상태 추가

```typescript
// useChat.ts 내부 추가 상태
const [providers, setProviders] = useState<ProviderInfo[]>([]);
const [activeProvider, setActiveProvider] = useState<string>('claude');

// 초기화 시 Extension에 provider_list 요청
useEffect(() => {
  vscode.postMessage({ type: 'get_provider_list' });
}, [vscode]);

// handleMessage switch에 케이스 추가
case 'provider_list': {
  setProviders(message.payload.providers);
  setActiveProvider(message.payload.activeProvider);
  break;
}
case 'provider_changed': {
  setActiveProvider(message.payload.provider);
  break;
}

// selectProvider 콜백
const selectProvider = useCallback(
  (key: string) => {
    vscode.postMessage({ type: 'select_provider', payload: { provider: key } });
  },
  [vscode]
);
```

#### P2-9-3. App.tsx header 변경

```tsx
// Phase 2: ProviderSelector를 헤더에 추가
<header className="px-4 py-3 border-b border-gray-300 dark:border-gray-600
                   flex items-center justify-between gap-2">
  <span className="text-lg font-semibold">Vibe Flow</span>
  <ProviderSelector
    providers={providers}
    activeProvider={activeProvider}
    isStreaming={isStreaming}
    onSelect={selectProvider}
  />
</header>
```

---

### P2-10. 프로바이더 전환 전체 상태 흐름

```
[사용자가 드롭다운에서 "OpenAI" 선택]
  │
  ▼
ProviderSelector.onChange
  → vscode.postMessage({ type: 'select_provider', payload: { provider: 'openai' } })
  │
  ▼
Extension: handleSelectProvider('openai')
  │
  ├─ PROVIDER_LIST에서 'openai' 정보 조회
  ├─ requiresApiKey = true → getSecret('openai-api-key') 조회
  │
  ├─ [키 없음]
  │   → sendMessage({ type: 'api_key_status', payload: { provider: 'openai', exists: false } })
  │   → useChat의 'api_key_status' 핸들러가 API 키 입력 UI 표시
  │   → 사용자 입력 → WVMsg_SaveApiKey 발송 → Extension 저장
  │   → 사용자가 다시 드롭다운에서 OpenAI 선택 → 이번엔 키 있음 → 전환 진행
  │
  └─ [키 있음]
      → activeProviderKey = 'openai'
      → provider = null  (lazy init: 다음 chat_send 때 초기화)
      → sendMessage({ type: 'provider_changed', payload: { provider: 'openai', modelName: 'gpt-4o' } })
      │
      ▼
  useChat: 'provider_changed' 수신
      → setActiveProvider('openai')
      → ProviderSelector UI가 'OpenAI / gpt-4o'로 업데이트

[사용자가 메시지 전송]
  │
  ▼
handleChatSend()
  → createProvider('openai') → new OpenAIProvider()
  → getSecret('openai-api-key') → apiKey
  → provider.initialize(apiKey)
  → provider.chat(messages, TOOLS, signal) 시작
  → 스트리밍 청크 WebView로 전달
```

---

### P2-11. Ollama 전용 흐름 (API 키 없음)

```
[사용자가 드롭다운에서 "Ollama" 선택]
  │
  ▼
Extension: handleSelectProvider('ollama')
  │
  ├─ requiresApiKey = false → API 키 확인 생략
  ├─ activeProviderKey = 'ollama'
  ├─ provider = null
  └─ sendMessage({ type: 'provider_changed', payload: { provider: 'ollama', modelName: 'llama3.2' } })

[사용자가 메시지 전송]
  │
  ▼
handleChatSend()
  → createProvider('ollama') → new OllamaProvider()
  → provider.initialize('')   // 빈 문자열 전달, OllamaProvider는 무시
  → provider.chat(...)
  → fetch('http://localhost:11434/api/chat', ...)
  │
  ├─ [Ollama 미실행] ECONNREFUSED
  │   → throw new Error('Ollama가 실행 중이지 않습니다. ollama serve 명령으로 시작하세요.')
  │   → handleChatSend catch → sendMessage({ type: 'stream_error', ... })
  │
  └─ [정상] NDJSON 스트리밍 → StreamChunk yield → WebView로 전달
```

---

### P2-12. Phase 2 구현 순서 권고

기존 Phase 1 코드가 완성된 상태에서 아래 순서로 진행한다.

```
1. npm install openai @google/generative-ai
   (package.json dependencies에 추가)

2. src/utils/types.ts 수정
   - WVMsg_SelectProvider, WVMsg_GetProviderList 추가
   - ExtMsg_ProviderChanged, ExtMsg_ProviderList, ProviderInfo 추가
   - WebviewToExtMessage, ExtensionToWebviewMessage 유니온 타입 확장

3. src/providers/openai.ts 신규 생성
   - ILLMProvider 구현
   - tool_calls 누적 로직 주의

4. src/providers/gemini.ts 신규 생성
   - ILLMProvider 구현
   - Gemini role 변환 규칙 적용

5. src/providers/ollama.ts 신규 생성
   - ILLMProvider 구현
   - fetch 기반 NDJSON 파싱
   - ECONNREFUSED 에러 메시지 변환

6. src/providers/factory.ts 수정
   - ProviderKey 타입 추가
   - switch문으로 4개 프로바이더 지원

7. src/extension.ts 수정
   - activeProviderKey 상태 변수 추가
   - PROVIDER_LIST 상수 추가
   - handleSelectProvider() 함수 추가
   - handleWebviewMessage에 select_provider, get_provider_list 케이스 추가
   - handleChatSend에서 하드코딩된 'claude' → activeProviderKey로 교체

8. src/webview/components/ProviderSelector.tsx 신규 생성
   - select + option 렌더링
   - isStreaming 시 disabled

9. src/webview/hooks/useChat.ts 수정
   - providers, activeProvider 상태 추가
   - get_provider_list 초기 요청 추가
   - provider_list, provider_changed 메시지 핸들러 추가
   - selectProvider 콜백 추가
   - 반환값에 providers, activeProvider, selectProvider 추가

10. src/webview/App.tsx 수정
    - useChat에서 providers, activeProvider, selectProvider 구조 분해
    - header에 ProviderSelector 컴포넌트 추가

11. npm run compile → 컴파일 오류 없음 확인
12. F5 디버그 → 드롭다운 전환 및 각 프로바이더 채팅 동작 확인
```

---

### P2-13. 설계 결정 및 제약사항

| 결정 | 내용 | 이유 |
|---|---|---|
| Lazy initialization | provider 인스턴스를 chat_send 시점에 생성 | 프로바이더 전환 후 즉시 초기화하면 불필요한 API 호출 발생 가능 |
| API 키 재입력 없음 | 전환 시 키가 있으면 기존 저장 키 재사용 | 사용성 우선, 보안은 SecretStorage가 담당 |
| 스트리밍 중 전환 금지 | ProviderSelector를 isStreaming=true 시 disabled | 진행 중인 스트림과 프로바이더 불일치 방지 |
| Ollama 모델 고정 | 기본값 llama3.2, Phase 2에서 변경 불가 | YAGNI — 모델 선택 UI는 Phase 3 이후 |
| Gemini Tool Use | Phase 2에서 Function Calling 구현 포함 | Gemini 1.5 Pro는 Function Calling 지원 |
| OpenAI tool_calls 누적 | index 기반 Map으로 조각 누적 | OpenAI 스트리밍 API 특성상 조각 분리 전달 |
| 대화 히스토리 초기화 | 프로바이더 전환 시 conversationHistory 유지 | 메시지 형식이 다를 수 있으나 공통 ChatMessage 타입으로 추상화됨 |

**대화 히스토리 주의**: `conversationHistory`는 공통 `ChatMessage[]` 타입을 사용하므로 프로바이더 전환 시 이전 대화를 그대로 유지한다. 단, 이전 프로바이더에서 생성된 `toolCallId`가 새 프로바이더에서 유효하지 않을 수 있으므로, 도구 사용 중 전환은 `isStreaming` 시 비활성화로 방지한다.

---

**문서 끝**  
**Phase 1**: 완료  
**Phase 2**: 설계 완료 — Developer Agent 구현 대기
