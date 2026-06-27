# Changelog

All notable changes to Vibe Flow are documented here.  
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) · Versioning: [Semantic Versioning](https://semver.org/)

---

## [Unreleased]

---

## [0.1.0] - 2026-06-27

### Added

#### Core Chat
- Multi-provider AI support in VSCode sidebar: Claude (Anthropic), OpenAI (GPT-4o), Gemini, Ollama (local, no API key required)
- Streaming responses with real-time token display
- Chat history persistence — conversations survive VSCode restarts
- Clear history command (`Vibe Flow: Clear History`)

#### AI Tools
- `read_file` — Read any file in the workspace
- `write_file` — Create or modify files with diff preview + user approval gate
- `run_terminal` — Execute shell commands with dangerous pattern detection and user approval
- `list_directory` — Explore project structure
- `search_code` — Regex-based workspace-wide code search

#### Security & Safety
- API keys stored exclusively in VSCode SecretStorage (OS credential manager encrypted)
- Dangerous terminal pattern detection (rm -rf, sudo, curl|sh, fork bomb, etc.)
- All file writes and terminal commands require explicit user approval
- Tool loop limit (max 10 iterations) to prevent infinite retry

#### Settings & Configuration
- Inline Settings Panel: API key management per provider, Ollama model auto-discovery
- Workspace / Global config toggle (saves to `.vscode/settings.json` or global settings)
- Provider-specific context window thresholds (configurable trigger/target %)
- Custom system prompt per workspace

#### Developer Experience
- Smart context management: auto-trim old messages when approaching token limit, provider-specific thresholds
- Enhanced error handling: Anthropic SDK error type classification (auth / rate limit / network)
- retry-after header support for rate limit backoff
- Activity Bar icon with secondary sidebar support
- Internationalization: English and Korean (`navigator.language` auto-detection)

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| 0.1.0 | 2026-06-27 | Initial release — multi-provider AI chat, file/terminal tools, history, i18n |
