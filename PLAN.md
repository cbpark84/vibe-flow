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

- [ ] 전체 기능 통합 테스트
- [ ] 보안 감시 (API 키 노출 검사)
- [ ] 성능 최적화 (번들 크기, 메모리)
- [x] 에러 처리 및 사용자 메시지 개선 (Step 1: Anthropic 공식 에러 타입 분류)
- [x] SettingsPanel 인라인 에디터 (Workspace/Global 저장 토글, 직접 수정 가능)
- [x] SettingsPanel API Key 관리 탭 (프로바이더별 키 등록/삭제, Ollama URL+모델 선택)
- [x] SettingsPanel General 탭: 프로바이더별 Max Tokens 슬라이더
- [x] Ollama 모델 목록 자동 로드 (GET /api/tags)
- [x] ESLint 0 경고 달성 (TypeScript 반환 타입 어노테이션 완비)
- [ ] 다국어 지원 (i18n)
- [ ] CI/CD 파이프라인 구축
- [ ] 마켓플레이스 README, 스크린샷, 설정 가이드
- [ ] 배포 및 버전 관리

**산출물**:
- VSCode Marketplace 등록 완료
- 정식 v1.0.0 릴리스

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

**작성일**: 2026-06-26  
**버전**: 1.4  
**상태**: Phase 3 Complete, Phase 4 In Progress
