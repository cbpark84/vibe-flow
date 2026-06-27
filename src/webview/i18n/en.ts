const en = {
  // Header
  appTitle: '⚡ Vibe Flow',
  settings: 'Settings',
  clearHistory: 'Clear history',

  // Chat
  welcomeTitle: 'Vibe Flow',
  welcomeSubtitle: 'Ask anything about your code',
  chatPlaceholder: 'Ask anything...',
  send: 'Send',
  cancel: 'Cancel',
  thinking: 'Thinking...',

  // Provider
  selectProvider: 'Select provider',
  providerNotConfigured: 'API key not configured',

  // Tool approval
  approveWriteFile: 'Approve file write',
  rejectWriteFile: 'Reject',
  approveTerminal: 'Run command',
  rejectTerminal: 'Cancel',
  newFile: 'New file',
  modifyFile: 'Modify file',
  dangerousCommand: '⚠️ Dangerous command',

  // Settings panel
  settingsTitle: 'Settings',
  generalTab: 'General',
  apiKeysTab: 'API Keys',
  defaultProvider: 'Default Provider',
  systemPrompt: 'System Prompt',
  systemPromptPlaceholder: 'Enter custom system prompt...',
  maxTokens: 'Max Tokens',
  saveWorkspace: 'Save (Workspace)',
  saveGlobal: 'Save (Global)',
  close: 'Close',
  openVSCodeSettings: 'Open VSCode Settings',

  // API Keys
  apiKeyPlaceholder: 'Enter API key...',
  apiKeyRegistered: '✅ Configured',
  apiKeyNotRegistered: '⚠️ Not configured',
  save: 'Save',
  delete: 'Delete',
  ollamaUrl: 'Ollama URL',
  ollamaModel: 'Model',
  loadModels: 'Load models',
  refresh: 'Refresh',
  update: 'Update',
  saveKey: 'Save Key',
  ollamaConnected: '🟢 Connected',
  ollamaNotConnected: '🔴 Not connected',

  // Errors
  errorApiKey: (provider: string): string => `${provider} API key is not configured. Run "Vibe Flow: Set API Key".`,
  errorNetwork: 'Network error. Please check your connection.',
  errorRateLimit: 'Rate limit exceeded. Please try again later.',
  errorUnknown: 'An unknown error occurred.',

  // Settings panel labels
  workspaceSettings: 'Workspace Settings',
  aiRequestsWillUseThisProviderByDefault: 'AI requests will use this provider by default',
  customInstructionsForTheAIAssistant: 'Custom instructions for the AI assistant',
  maxTokensPerResponse: 'Max Tokens per Response',
  recommended: 'recommended',
  saveLocation: 'Save Location',
  workspace: 'Workspace',
  global: 'Global',
  workspaceSettingsDescription: '.vscode/settings.json (project-level)',
  globalSettingsDescription: 'User settings (all projects)',
  enterNewKey: 'Enter new key...',
  customSystemPromptOptional: 'Enter custom system prompt (optional)',
} as const;

export default en;
export type I18nMessages = typeof en;
