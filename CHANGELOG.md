# Changelog

All notable changes to Vibe Flow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added (2026-06-26)

#### Phase 3 Completion: Diff Preview & Workspace Settings
- **DiffViewer Component** (`src/webview/components/DiffViewer.tsx`):
  - Structured diff preview with line numbers, hunk headers (`@@`), and change statistics (+N/-N)
  - Unified diff format parser for clear visualization of file changes
  - Integration with `write_file` tool approval workflow

- **Workspace Settings** (`src/utils/workspaceConfig.ts`, `src/webview/components/SettingsPanel.tsx`):
  - `.vscode/settings.json` or VSCode workspace settings support
  - Provider-specific configuration:
    - `vibeflow.defaultProvider`: Set default LLM provider (claude/openai/gemini/ollama)
    - `vibeflow.systemPrompt`: Custom system prompt per workspace
    - `vibeflow.maxTokensPerRequest`: Max tokens per request (default 4096)
  - Real-time WebView updates on settings changes via `onDidChangeConfiguration` listener

#### Phase 4: Error Handling & User Experience (Step 1)
- **Anthropic Error Handler** (`src/utils/errorHandler.ts`):
  - Official Anthropic SDK error classification:
    - `APIUserAbortError`: User cancellation (normal, non-retryable)
    - `AuthenticationError`: Invalid API key (401, non-retryable)
    - `RateLimitError`: Rate limit exceeded (429, retryable with retry-after header)
    - `APIConnectionTimeoutError`: Request timeout (retryable)
    - `APIConnectionError`: Network connection failure (retryable)
    - `InternalServerError`: Server error 500+ (retryable)
    - Generic `APIError`: Other HTTP errors with status codes
  - `request_id` logging for API support tickets
  - User-friendly emoji-prefixed error messages:
    - ❌ Authentication issues
    - ⏱️ Rate limit (with retry-after calculation)
    - 🌐 Network errors
    - 🔧 Server errors
    - ⌛ Timeout errors
    - ⏹️ User cancellation

- **Claude Provider Improvements** (`src/providers/claude.ts`):
  - Explicit timeout: 60 seconds (vs. default 600s)
  - Explicit maxRetries: 2 (official default)
  - Try/catch error handling in streaming with proper cleanup
  - Tool loop infinite-loop prevention: max 10 iterations per message

- **Tool Approval UX** (`src/webview/components/ToolApproval.tsx`):
  - 2-minute timeout for `write_file` and `run_terminal` approvals
  - Error message-specific red-box UI with retryable hint
  - Improved tool status feedback

#### Phase 4: Settings Panel — API Key Management & Per-Provider Token Control (2026-06-26)

- **SettingsPanel 탭 리디자인** (`src/webview/components/SettingsPanel.tsx`):
  - ⚙️ General / 🔑 API Keys 두 탭으로 분리
  - API 키 미등록 프로바이더 선택 시 API Keys 탭 자동 오픈

- **🔑 API Keys 탭**:
  - Claude / OpenAI / Gemini: 등록 상태 배지(✅ / ⚠️), 비밀번호 입력, Save / Update / Delete
  - Ollama: URL 입력, Refresh 버튼 → `GET /api/tags`로 모델 목록 로드, 모델 드롭다운 선택
  - 입력 필드 `type="password"` — 키 값 노출 없음

- **⚙️ General 탭 — 프로바이더별 Max Tokens 슬라이더**:
  - Claude: 256 ~ 16,384 토큰 (기본값 4,096)
  - OpenAI: 256 ~ 4,096 토큰 (기본값 2,048)
  - Gemini: 256 ~ 8,192 토큰 (기본값 2,048)
  - Ollama: 256 ~ 4,096 토큰 (기본값 2,048)
  - 슬라이더 우측에 현재 값 표시, 추천값 안내

- **WorkspaceConfig 확장** (`src/utils/workspaceConfig.ts`, `src/utils/types.ts`):
  - `maxTokensPerRequest` 단일 값 → 프로바이더별 분리: `claudeMaxTokens`, `openaiMaxTokens`, `geminiMaxTokens`, `ollamaMaxTokens`
  - Ollama 연결 설정 추가: `ollamaUrl` (기본값 `http://localhost:11434`), `ollamaModel` (기본값 `llama3.2`)

- **Extension 메시지 핸들러 추가** (`src/extension.ts`):
  - `delete_api_key`: SecretStorage에서 키 삭제, 전체 상태 응답
  - `get_ollama_models`: Ollama REST API(`/api/tags`)로 설치된 모델 목록 조회
  - `check_all_api_keys`: 모든 프로바이더 키 등록 상태 일괄 응답

- **프로바이더 개선** (`src/providers/`):
  - 모든 프로바이더 `chat()` 시그니처에 `options?: { maxTokens?: number }` 추가
  - `claude.ts`: `max_tokens` 파라미터화 (기존 4096 하드코딩 → 설정값 사용)
  - `openai.ts`: `max_tokens` 파라미터화
  - `gemini.ts`: `maxOutputTokens` 파라미터화
  - `ollama.ts`: `num_predict` 파라미터화, URL/모델 생성자 주입으로 변경 (기존 상수 → 동적 설정)
  - `factory.ts`: `ProviderConfig` 인터페이스 추가, Ollama 생성 시 URL/모델 전달

### Changed

- `ToolApproval.tsx`: Replaced basic +/- colored diff with `DiffViewer` component for structured diffs
- `MessageBubble.tsx`: Dedicated error message rendering with error-specific styling
- `useVSCode.ts`: Removed `any` type, introduced `VsCodeApi` interface for type safety
- `contextManager.ts`: Provider-specific context thresholds moved to workspace settings (from hardcoded)
- `types.ts`: Extended message types for error handling and tool timeout

### Fixed

- `AbortError` class name error: Now uses official `Anthropic.APIUserAbortError`
- Tool loop infinite retry: Capped at 10 iterations to prevent API abuse
- Missing error context: Now logs request_id for API debugging
- Timeout handling: Explicit 60s timeout for Claude API calls (was implicit)
- **API 키 변경 즉시 반영** (`src/extension.ts`):
  - `save_api_key`: 활성 프로바이더 키 변경 시 `provider = null` 리셋 → 다음 채팅에 새 키 즉시 사용
  - `delete_api_key`: 활성 프로바이더 키 삭제 시 `provider = null` 리셋 → 삭제가 즉시 반영
  - 기존에는 VSCode 재시작 전까지 구 키가 메모리에 남아 계속 사용되는 버그 존재

---

## [v0.4.0] - 2026-06-15

### Added (Phase 3: Advanced Features)

- **Directory Exploration** (`list_directory`):
  - List workspace/project directory structure
  - AI can propose file organization changes

- **Code Search** (`search_code`):
  - Regex-based code search across workspace
  - AI can find functions, imports, patterns

- **Chat History Persistence**:
  - Save/load conversations via VSCode globalState
  - Survives VSCode restart
  - Clear button to reset history

- **Context Window Management**:
  - Provider-specific token limits (Claude 200k, GPT-4 128k, Gemini 1M, Ollama 32k)
  - Provider-specific thresholds:
    - Claude: Trigger 70%, Target 50%
    - OpenAI: Trigger 65%, Target 45%
    - Gemini: Trigger 75%, Target 55%
    - Ollama: Trigger 50%, Target 30%
  - Message trimming to stay within limits
  - System prompt always preserved

---

## [v0.3.0] - 2026-05-30

### Added (Phase 2: Multi-Provider Support)

- **Multi-Provider Support**:
  - OpenAI (GPT-4o, GPT-4 Turbo)
  - Google Gemini (gemini-1.5-pro)
  - Ollama (local LLMs)

- **Provider Selection UI**:
  - Dropdown to switch providers
  - Per-provider API key management

- **Provider Factory Pattern**:
  - Unified `ILLMProvider` interface
  - Token counting per provider
  - Provider-specific API handling

---

## [v0.2.0] - 2026-05-15

### Added (Phase 1 Enhancements)

- **Tool Approval UI**:
  - `write_file` requires explicit user approval with diff preview
  - `run_terminal` requires approval with danger pattern detection
  - DANGEROUS_PATTERNS list: rm -rf, sudo, mkfs, curl|sh, etc.

- **Chat Interface**:
  - Real-time streaming with postMessage
  - Tool approval requests with context
  - Error feedback to user

---

## [v0.1.0] - 2026-04-30

### Added (Phase 1: MVP)

- **Extension Host**:
  - VSCode 1.85+ compatibility
  - Extension registry (package.json contribution points)
  - SecretStorage for API key encryption

- **WebView UI** (React + Vite):
  - Chat interface
  - Provider selector
  - Message bubbles with streaming

- **Claude Provider**:
  - Anthropic SDK integration
  - Tool use / Function calling support

- **Tools**:
  - `read_file`: Read file contents
  - `write_file`: Create/modify files with user approval
  - `run_terminal`: Execute shell commands with approval

- **Security**:
  - API keys stored in VSCode SecretStorage
  - No plaintext secrets in config files
  - Safe terminal command patterns

---

[Unreleased]: https://github.com/cbpark84/vibe-flow/compare/v0.4.0...HEAD
[v0.4.0]: https://github.com/cbpark84/vibe-flow/compare/v0.3.0...v0.4.0
[v0.3.0]: https://github.com/cbpark84/vibe-flow/compare/v0.2.0...v0.3.0
[v0.2.0]: https://github.com/cbpark84/vibe-flow/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/cbpark84/vibe-flow/releases/tag/v0.1.0
