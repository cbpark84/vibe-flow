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
