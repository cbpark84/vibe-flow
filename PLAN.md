# VSCode AI Assistant 플러그인 개발 계획서

## 1. 프로젝트 개요

**프로젝트명**: Vibe Flow

**목적**: VSCode 사이드 패널에서 AI와 채팅하며 Claude Code처럼 개발할 수 있는 플러그인. 사용자는 자신의 API 키를 등록하여 여러 LLM 프로바이더를 자유롭게 선택하고 파일 편집, 터미널 실행 등을 AI의 지원을 받아 수행할 수 있다.

**핵심 가치**:
- 멀티 프로바이더 지원 (Claude, GPT, Gemini, Local LLM)
- 보안: API 키는 VSCode SecretStorage에만 저장
- 확장성: 처음부터 플러그인 아키텍처로 설계
- 개발자 경험: Claude Code와 유사한 채팅 인터페이스

---

## 2. 기술 스택

| 계층 | 기술 | 버전 | 용도 |
|------|------|------|------|
| **Extension Host** | TypeScript | 5.0+ | 플러그인 핵심 로직 |
| | VSCode Extension API | 1.85+ | VSCode 통합 |
| **WebView UI** | React | 18+ | 사용자 인터페이스 |
| | Vite | 5.0+ | 고속 번들링 |
| | Tailwind CSS | 3.0+ | 스타일링 |
| | TypeScript | 5.0+ | 타입 안전성 |
| **LLM SDK** | @anthropic-ai/sdk | 0.30+ | Claude API |
| | openai | 4.0+ | OpenAI API |
| | @google/generative-ai | 0.12+ | Gemini API |
| | Ollama REST API | - | 로컬 LLM |
| **빌드** | esbuild | 0.19+ | Extension 번들링 |
| | Vite | 5.0+ | WebView 번들링 |
| **테스트** | @vscode/test-electron | 2.3+ | Extension 테스트 |
| **린팅** | ESLint | 8.0+ | 코드 품질 |
| | Prettier | 3.0+ | 코드 포매팅 |

---

## 3. 아키텍처 개요

### 3.1 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                      VSCode 엔진                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│              Extension Host (TypeScript)                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  src/extension.ts: 진입점, 커맨드 등록                    │ │
│  │  src/tools/: 파일 시스템, 터미널 접근                     │ │
│  │  src/utils/: 보안, 컨텍스트 관리                          │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                    ↕ (postMessage)
┌──────────────────────────────────────────────────────────────┐
│             WebView (React + Vite + Tailwind)                │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  src/webview/App.tsx: 메인 UI                            │ │
│  │  src/webview/components/: 채팅, 프로바이더 선택기          │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│         Provider Adapter Layer (ILLMProvider)                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  src/providers/base.ts          ← 인터페이스 정의         │ │
│  │  src/providers/claude.ts        ← Claude 구현            │ │
│  │  src/providers/openai.ts        ← OpenAI 구현            │ │
│  │  src/providers/gemini.ts        ← Gemini 구현            │ │
│  │  src/providers/local.ts         ← Ollama 구현            │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────────┐
│            외부 LLM 서비스 (Cloud/Local)                       │
│  • Claude API (api.anthropic.com)                            │
│  • OpenAI API (api.openai.com)                               │
│  • Gemini API (generativelanguage.googleapis.com)            │
│  • Local LLM (localhost:11434 - Ollama)                      │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Extension Host ↔ WebView 통신

**원칙**: postMessage 기반 양방향 통신, 타입 안전성 보장

```typescript
// WebView → Extension
webviewAPI.postMessage({
  type: 'chat_message',
  payload: { message: '파일을 읽어줘', files: ['src/index.ts'] }
});

// Extension → WebView
panel.webview.postMessage({
  type: 'stream_chunk',
  payload: { content: 'Hello world' }
});
```

### 3.3 Provider Adapter 패턴

모든 LLM 프로바이더는 `ILLMProvider` 인터페이스를 구현:

```typescript
interface ILLMProvider {
  name: string;
  initialize(apiKey: string): Promise<void>;
  chat(messages: ChatMessage[], tools?: Tool[]): AsyncIterableIterator<string>;
  countTokens(text: string): Promise<number>;
}
```

### 3.4 Tool Use / Function Calling 구조

플러그인이 지원할 도구들:

| 도구 | 설명 | 구현 위치 |
|------|------|---------|
| `read_file` | 파일 내용 읽기 | `src/tools/fileSystem.ts` |
| `write_file` | 파일 쓰기 (사용자 승인 필수) | `src/tools/fileSystem.ts` |
| `list_directory` | 디렉토리 목록 | `src/tools/fileSystem.ts` |
| `search_code` | 정규식으로 코드 검색 | `src/tools/fileSystem.ts` |
| `run_terminal` | 터미널 명령어 실행 | `src/tools/terminal.ts` |

### 3.5 Ollama Agentic Layer (Phase 5)

Ollama 프로바이더가 단순 채팅을 넘어 **Claude Code 수준의 에이전트 동작**을 수행하기 위한 계층.

**역할 분담**:
- **vibe-rag (Python 별도 프로젝트)**: 프로젝트 탐색, Knowledge Graph, RAG 검색 → MCP 서버로 제공
- **Vibe Flow 플러그인 (이 프로젝트)**: MCP 클라이언트 연결 + Task Planner + Verify Loop

**플러그인 내부 구조** (`src/agent/`):
- `mcpClient.ts`: vibe-rag MCP 서버 연결
- `taskPlanner.ts`: `.ai/tasks/task_xxx.md` 생성 및 사용자 승인 흐름
- `microTaskDecomposer.ts`: 함수 단위 마이크로 태스크 분해
- `verifyLoop.ts`: 컴파일 → 린트 → 테스트 자동 검증 루프

---

## 4. 예상 디렉토리 구조

```
vibe-flow/
├── src/
│   ├── extension.ts                 # Extension Host 진입점
│   ├── providers/
│   │   ├── base.ts                  # ILLMProvider 인터페이스
│   │   ├── claude.ts                # Claude 프로바이더
│   │   ├── openai.ts                # OpenAI 프로바이더
│   │   ├── gemini.ts                # Gemini 프로바이더
│   │   ├── local.ts                 # Ollama 프로바이더
│   │   └── factory.ts               # 프로바이더 팩토리
│   ├── tools/
│   │   ├── fileSystem.ts            # 파일 시스템 접근 도구
│   │   ├── terminal.ts              # 터미널 실행 도구
│   │   └── types.ts                 # 도구 타입 정의
│   ├── webview/
│   │   ├── main.tsx                 # React 진입점
│   │   ├── App.tsx                  # 메인 앱 컴포넌트
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx        # 채팅 인터페이스
│   │   │   ├── MessageBubble.tsx    # 메시지 버블
│   │   │   ├── ProviderSelector.tsx # 프로바이더 선택
│   │   │   ├── FileViewer.tsx       # 파일 미리보기
│   │   │   └── ToolApproval.tsx     # 도구 실행 승인
│   │   ├── hooks/
│   │   │   ├── useChat.ts           # 채팅 로직 훅
│   │   │   ├── useProvider.ts       # 프로바이더 관리 훅
│   │   │   └── useVSCode.ts         # VSCode API 접근 훅
│   │   └── styles/
│   │       └── globals.css          # 전역 스타일
│   └── utils/
│       ├── contextManager.ts        # 토큰 관리, 컨텍스트 윈도우
│       ├── secretStorage.ts         # 보안: API 키 저장/조회
│       ├── logger.ts                # VSCode OutputChannel 래퍼
│       └── types.ts                 # 공용 타입 정의
│   └── agent/                           # Ollama Agentic Layer (Phase 5) — 플러그인 담당 부분
│       ├── mcpClient.ts                 # vibe-rag MCP 서버 연결 클라이언트
│       ├── taskPlanner.ts               # 태스크 플랜 생성/관리 (.ai/tasks/)
│       ├── microTaskDecomposer.ts       # 마이크로 태스크 분해 엔진
│       └── verifyLoop.ts                # 컴파일/린트/테스트 자동 검증
# NOTE: projectUnderstanding, knowledgeGraph, contextRetriever는 vibe-rag (Python) 프로젝트로 이관
├── .ai/                                 # Ollama 에이전트 영구 메모리
│   ├── tasks/                           # 태스크 플랜 파일 (task_xxx.md)
│   ├── memory/                          # 프로젝트 요약, 아키텍처 메모
│   └── knowledge/                       # Knowledge Graph (graph.json)
├── test/
│   ├── suite/
│   │   └── extension.test.ts        # Extension 테스트
│   └── runTest.ts                   # 테스트 러너
├── .vscode/
│   └── launch.json                  # 디버그 설정
├── package.json
├── tsconfig.json
├── vite.config.ts                   # WebView 빌드 설정
├── esbuild.config.js                # Extension 빌드 설정
└── README.md
```

---

## 5. 개발 단계 (Phase)

### Phase 1: MVP (Minimum Viable Product) - Week 1-2
**목표**: 최소 기능 동작 확인

- [x] 프로젝트 구조 및 빌드 설정
- [x] Extension Host 기본 세팅 (VSCode Extension API)
- [x] WebView UI 기본 틀 (React + Vite)
- [x] Claude API 프로바이더 구현
- [x] 채팅 UI 및 postMessage 통신
- [x] 파일 읽기 도구 (`read_file`)
- [x] 파일 쓰기 도구 (`write_file`) - 미리보기 + 사용자 승인
- [x] run_terminal 도구 - 위험 명령어 차단 + 사용자 승인
- [x] API 키 보안 저장 (SecretStorage)
- [x] 기본 문서화

**산출물**: 
- 실행 가능한 VSCode 플러그인 (.vsix)
- 간단한 사용 설명서

---

### Phase 2: 멀티 프로바이더 지원 - Week 3-4
**목표**: OpenAI, Gemini, Local LLM 통합

- [x] OpenAI 프로바이더 구현
- [x] Gemini 프로바이더 구현
- [x] Ollama (로컬 LLM) 프로바이더 구현
- [x] 프로바이더 선택 UI 개선
- [x] 각 프로바이더별 API 키 관리
- [x] 프로바이더별 토큰 카운팅 로직
- [x] App.tsx ProviderSelector 연동

**산출물**:
- 각 프로바이더 테스트 완료
- 프로바이더별 설정 가이드

---

### Phase 3: 고급 기능 - Week 5-6
**목표**: 개발 환경 통합 심화

- [x] 터미널 실행 도구 (`run_terminal`) ← Phase 1에서 조기 완료
- [x] 디렉토리 목록 도구 (`list_directory`)
- [x] 코드 검색 도구 (`search_code`)
- [x] Diff 미리보기 UI
- [x] 컨텍스트 윈도우 관리 (파일 청킹 + 토큰 카운팅)
- [x] 채팅 히스토리 저장/로드
- [x] 워크스페이스별 설정

**산출물**:
- 고급 기능 데모 비디오
- 확장 설명서

---

### Phase 4: 마켓플레이스 배포 - Week 7-8
**목표**: VSCode 마켓플레이스 정식 배포

- [x] 전체 기능 통합 테스트 (31개 테스트 통과: terminal/filesystem/errorHandler/factory)
- [x] 보안 감시 (API 키 노출 검사) (PASS: 하드코딩 없음, SecretStorage 준수, .gitignore 보강)
- [x] 성능 최적화 (번들 크기, 메모리) (Extension: 705.9KB, WebView: 166KB, 메모리 200개 메시지 상한)
- [x] 에러 처리 및 사용자 메시지 개선 (Step 1: Anthropic 공식 에러 타입 분류)
- [x] SettingsPanel 인라인 에디터 (Workspace/Global 저장 토글, 직접 수정 가능)
- [x] SettingsPanel API Key 관리 탭 (프로바이더별 키 등록/삭제, Ollama URL+모델 선택)
- [x] SettingsPanel General 탭: 프로바이더별 Max Tokens 슬라이더
- [x] Ollama 모델 목록 자동 로드 (GET /api/tags)
- [x] ESLint 0 경고 달성 (TypeScript 반환 타입 어노테이션 완비)
- [x] 다국어 지원 (i18n) (VSCode l10n 공식 방식: package.nls.json/ko, WebView I18nContext, l10n 번들)
- [x] CI/CD 파이프라인 구축 (GitHub Actions: ci.yml, release.yml, dependency-review.yml)
- [x] 마켓플레이스 README, 스크린샷, 설정 가이드 (CHANGELOG.md, .vscodeignore, images/SCREENSHOTS.md, package.json 메타데이터)
- [ ] 배포 및 버전 관리

**산출물**:
- VSCode Marketplace 등록 완료
- 정식 v1.0.0 릴리스

---

### Phase 5: Ollama Agentic Mode - Week 9-12
**목표**: Ollama에서 Claude Code 수준의 자율 에이전트 동작 구현

**아키텍처 방향 (2026-06-27 확정)**:
- RAG / Knowledge Graph는 **별도 Python 프로젝트**로 구현 후 MCP 서버로 감싸기
- Vibe Flow 플러그인은 MCP 클라이언트로 연결하여 에이전트 루프만 담당
- 두 프로젝트가 역할을 나눠 각자 독립적으로 개선 가능

**전체 흐름**:

```
사용자 요청
↓
[Vibe Flow 플러그인]  ─── MCP 호출 ───▶  [vibe-rag 서비스 (Python)]
  에이전트 루프                              - 프로젝트 구조 탐색
  Task Planner                               - Knowledge Graph 조회
  Verify Loop                                - RAG 컨텍스트 검색
       │                                           │
       ▼                                           ▼
[Ollama 로컬 LLM]  ◀──────── 컨텍스트 ───────────────
  마이크로 태스크 추론
       │
       ▼
[Verify Loop]
  컴파일 → 린트 → 테스트 → Diff 리뷰
```

**설계 원칙 (Local LLM 특화)**:

| 원칙 | 설명 |
|------|------|
| Explore First | 코드 수정 전 반드시 프로젝트 전체 탐색 |
| Plan Before Code | 플랜 파일 생성 및 승인 없이 구현 불가 |
| Micro Decomposition | 한 번에 하나의 함수만 수정 |
| Verify Every Step | 각 수정 후 컴파일/린트/테스트 필수 |
| Continuous Reflection | 각 도구 실행 후 플랜 유효성 재점검 |

**구현 항목 — 프로젝트별 분류**:

#### 📁 [vibe-rag] Python 별도 프로젝트 (임시명 — 개발 시점에 구체화)

- [ ] **Project Understanding Pipeline**
  - 언어 / 패키지 매니저 / 빌드 / 테스트 프레임워크 자동 감지
  - 폴더 트리 + 의존성 그래프 생성
  - 진입점 / 아키텍처 패턴 감지
  - 결과를 `.ai/memory/project_summary.md`에 영구 저장

- [ ] **Knowledge Graph 생성**
  - File → Class → Function → Call → Dependency → Test 그래프
  - Python NetworkX 기반 구현 (TypeScript보다 생태계 풍부)
  - `.ai/knowledge/graph.json`에 저장, 변경 시 자동 업데이트

- [ ] **Context Retrieval (RAG)**
  - Knowledge Graph 기반 관련 파일/함수만 선별 로드
  - 임베딩 + 벡터 DB (Chroma or Qdrant — 개발 시점에 확정)
  - 전체 저장소 로딩 방지

- [ ] **MCP 서버 래핑**
  - 위 3개 기능을 MCP 도구로 노출
  - 예: `understand_project`, `query_graph`, `retrieve_context`
  - Vibe Flow 플러그인 및 기타 MCP 클라이언트에서 재사용 가능

#### 📁 [Vibe Flow 플러그인] 이 프로젝트 (src/agent/)

- [ ] **MCP 클라이언트 연결**
  - vibe-rag MCP 서버 연결
  - Ollama + MCP 도구 연동

- [ ] **Task Planner**
  - `.ai/tasks/task_xxx.md` 자동 생성
  - 목표 / 영향 파일 / 필요 도구 / 리스크 / 검증 방법 / 롤백 전략 포함
  - 사용자 승인 후 실행 시작

- [ ] **Micro Task Decomposition 엔진**
  - 큰 목표를 함수 단위 스텝으로 분해
  - 각 스텝은 독립 실행 가능하도록 설계

- [ ] **Verify Loop 자동화**
  - 각 편집 후 자동으로: 컴파일 → 린트 → 단위 테스트 → Diff 리뷰
  - 실패 시: 롤백 → 재플랜 → 재시도

- [ ] **Persistent Memory**
  - `.ai/` 폴더에 프로젝트 컨텍스트 영구 저장
  - 다음 세션에서 즉시 복원

- [ ] **자동 문서 생성**
  - `PROJECT.md`, `ARCHITECTURE.md`, `STYLE_GUIDE.md`, `MODULES.md` 자동 생성/갱신
  - `.ai/tasks/TASK_HISTORY.md` 완료 태스크 이력 기록

**산출물**:
- [vibe-rag] Python RAG/KG 서비스 + MCP 서버 (별도 저장소)
- [Vibe Flow] MCP 클라이언트 + 에이전트 루프 구현
- Ollama 로컬 에이전트 동작 데모
- `.ai/` 폴더 기반 프로젝트 영구 메모리 시스템
- 마이크로 태스크 분해 및 검증 루프 문서화

---

## 6. 주요 기술 결정 사항

### 6.1 API 키 보안
- **방식**: VSCode `SecretStorage` API 사용
- **이유**: 로컬 시스템의 자격증명 관리자에 암호화 저장
- **구현**: `src/utils/secretStorage.ts`에서 중앙화 관리
- **절대 금지**: 설정 파일(json, env)에 평문 저장

### 6.2 스트리밍
- **방식**: Server-Sent Events 대신 postMessage + 청크 전송
- **이유**: VSCode WebView는 외부 네트워크 접근 불가, 모든 통신은 Extension Host를 거쳐야 함
- **흐름**:
  1. WebView → Extension: "메시지 전송" 요청
  2. Extension → LLM: 스트리밍 시작
  3. Extension → WebView: 각 청크마다 postMessage (type: 'stream_chunk')
  4. WebView: 실시간으로 UI 갱신

### 6.3 파일 편집
- **흐름**:
  1. AI가 `write_file` 도구 호출
  2. Extension이 diff 생성 및 미리보기 UI 표시
  3. 사용자가 "승인" 또는 "거절" 선택
  4. Extension이 파일 쓰기 또는 취소
  5. WebView에 결과 전송
- **이유**: 의도하지 않은 파일 수정 방지

### 6.4 컨텍스트 관리
- **토큰 제한**: 프로바이더별 최대 토큰 설정 (Claude: 200K, GPT-4: 128K, Gemini: 1M 등)
- **파일 청킹**: 큰 파일은 청크 단위로 전달
- **윈도우 슬라이딩**: 오래된 메시지부터 제거하되, 시스템 프롬프트는 항상 유지
- **구현**: `src/utils/contextManager.ts`

### 6.5 SettingsPanel 인라인 편집 (Phase 4 추가)
- **변경**: 뷰어 전용 → 에디터 폼 (select, textarea, number input)
- **저장 대상 선택**: Workspace(.vscode/settings.json) / Global(~/settings.json) 토글 UI
- **메시지 흐름**: `save_workspace_config { config, target }` → Extension → `configuration.update(key, value, ConfigurationTarget)`
- **자동 반영**: 저장 후 VSCode `onDidChangeConfiguration` 발화 → 기존 `workspace_config_changed` 메시지로 UI 자동 갱신
- **"Open VSCode Settings" 버튼**: 유지 (직접 편집 외에 VSCode 네이티브 설정 UI 접근 경로 보존)

### 6.7 다국어 지원 (i18n) 설계 (Phase 4 완료)

**언어 전환 방식**: VSCode 공식 l10n 방식 채택
- Extension Host / 마켓플레이스: VSCode `Configure Display Language` 설정 자동 반영
- WebView: `navigator.language` 기반 자동 감지 (ko → 한국어, 그 외 → 영어)
- **앱 내 언어 선택 UI 없음**: VSCode 표준 패턴 준수 (대부분의 공식 익스텐션 동일 방식)

**지원 언어**: 영어(기본), 한국어

**파일 구조**:
```
package.nls.json          ← 마켓플레이스 영어 기본값
package.nls.ko.json       ← 마켓플레이스 한국어 번역
l10n/
  bundle.l10n.json        ← Extension Host 영어 번들
  bundle.l10n.ko.json     ← Extension Host 한국어 번들
src/webview/i18n/
  en.ts                   ← WebView 영어 메시지
  ko.ts                   ← WebView 한국어 메시지
  index.ts                ← I18nContext + useI18n 훅
```

**언어 추가 방법** (향후 일본어 등):
1. `package.nls.ja.json` 생성
2. `l10n/bundle.l10n.ja.json` 생성
3. `src/webview/i18n/ja.ts` 생성 후 `index.ts`에 등록

### 6.6 Ollama Agentic Mode 설계 원칙 (Phase 5)

**배경**: Ollama 로컬 모델은 클라우드 LLM 대비 컨텍스트 윈도우가 작고 추론 능력이 약함.
이를 구조적으로 보완하기 위해 5가지 설계 원칙을 강제한다.

**5가지 핵심 원칙**:

1. **Explore First**
   - 코드 수정 전 반드시 프로젝트 전체 구조를 탐색
   - 폴더 구조 / 의존성 / 패턴 / 빌드 / 테스트 / 컨벤션 파악 완료 후에만 구현 가능

2. **Planning Before Coding**
   - 모든 구현 요청은 `.ai/tasks/task_xxx.md` 플랜 파일 생성으로 시작
   - 플랜 미승인 시 구현 단계 진입 금지
   - 플랜 포함 항목: 목표 / 영향 파일 / 필요 도구 / 리스크 / 검증 방법 / 롤백 전략

3. **Micro Task Decomposition**
   - 큰 목표를 **함수 단위**로 분해 (이상적으로는 한 스텝 = 한 함수 수정)
   - 파일 전체 덮어쓰기 금지 → 함수 → 메서드 → 클래스 → 섹션 → 파일 순 선호
   - "인증 구현" ❌ → "미들웨어 위치 파악 → 인터페이스 추가 → 단위 테스트 작성 → 함수 구현 → 검증" ✅

4. **Plan → Execute → Verify Loop**
   - 각 스텝 실행 후 반드시 검증: 컴파일 → 린트 → 단위 테스트 → Diff 리뷰
   - 검증 실패 시: 롤백 → 재플랜 → 재시도 (다음 스텝 진입 금지)

5. **Continuous Reflection**
   - 각 도구 실행 후 3가지 질문:
     - 이전 스텝이 성공했는가?
     - 현재 플랜이 여전히 유효한가?
     - 태스크를 더 작게 분해해야 하는가?

**성공 지표**: 빠른 진행 ❌ / 검증된 진행 ✅

---

## 7. 미결 사항 (TBD)

| 항목 | 상태 | 담당 | 예상 해결 시점 |
|------|------|------|-------------|
| 플러그인 최종 이름 | ✅ Vibe Flow 확정 | PM | Week 1 |
| VSCode 마켓플레이스 계정 | 미준비 | 관리자 | Week 6 |
| 유료/무료 모델 결정 | 미정 | PM | Week 3 |
| 로컬 LLM 프로바이더 우선순위 | ✅ Ollama 채택 | Architect | Week 2 |
| 다국어 지원 범위 | 미정 | PM | Week 4 |
| 커스텀 시스템 프롬프트 기능 | 스코프 외 | - | 향후 고려 |

---

## 8. 성공 기준

✅ **기술적 기준**
- Extension이 VSCode 1.85+ 버전에서 정상 작동
- 모든 프로바이더 API 통신 성공
- 파일 읽기/쓰기 정확성 100%
- 메모리 누수 없음 (프로파일링 확인)

✅ **사용자 경험 기준**
- 5분 내 설치 및 초기 설정 완료
- 채팅 응답 지연 < 2초 (스트리밍 시작)
- 직관적인 UI (사용자 테스트)

✅ **품질 기준**
- 자동화 테스트 커버리지 > 80%
- ESLint 0 경고
- 보안 감시 패스

---

## 9. 참고 자료

- [VSCode Extension API](https://code.visualstudio.com/api)
- [VSCode WebView API](https://code.visualstudio.com/api/extension-guides/webview)
- [Anthropic SDK (JavaScript)](https://github.com/anthropics/anthropic-sdk-typescript)
- [Anthropic API Reference](https://docs.anthropic.com/en/api)
- [Claude Models](https://docs.anthropic.com/en/docs/about-claude/models)
- [OpenAI JS SDK](https://github.com/openai/node-sdk)
- [Google Generative AI SDK](https://github.com/google/generative-ai-js)
- [Ollama](https://ollama.ai/)

---

**작성일**: 2026-06-27  
**버전**: 1.7  
**상태**: Phase 3 Complete, Phase 4 In Progress, Phase 5 Planned
