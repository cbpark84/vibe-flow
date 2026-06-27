import type { I18nMessages } from './en';

const ko: I18nMessages = {
  // Header
  appTitle: '⚡ Vibe Flow',
  settings: '설정',
  clearHistory: '히스토리 삭제',

  // Chat
  welcomeTitle: 'Vibe Flow',
  welcomeSubtitle: '코드에 대해 무엇이든 물어보세요',
  chatPlaceholder: '무엇이든 물어보세요...',
  send: '전송',
  cancel: '취소',
  thinking: '생각 중...',

  // Provider
  selectProvider: '프로바이더 선택',
  providerNotConfigured: 'API 키 미등록',

  // Tool approval
  approveWriteFile: '파일 쓰기 승인',
  rejectWriteFile: '거절',
  approveTerminal: '명령어 실행',
  rejectTerminal: '취소',
  newFile: '새 파일',
  modifyFile: '파일 수정',
  dangerousCommand: '⚠️ 위험한 명령어',

  // Settings panel
  settingsTitle: '설정',
  generalTab: '일반',
  apiKeysTab: 'API 키',
  defaultProvider: '기본 프로바이더',
  systemPrompt: '시스템 프롬프트',
  systemPromptPlaceholder: '커스텀 시스템 프롬프트 입력...',
  maxTokens: '최대 토큰',
  saveWorkspace: '저장 (워크스페이스)',
  saveGlobal: '저장 (글로벌)',
  close: '닫기',
  openVSCodeSettings: 'VSCode 설정 열기',

  // API Keys
  apiKeyPlaceholder: 'API 키 입력...',
  apiKeyRegistered: '✅ 등록됨',
  apiKeyNotRegistered: '⚠️ 미등록',
  save: '저장',
  delete: '삭제',
  ollamaUrl: 'Ollama URL',
  ollamaModel: '모델',
  loadModels: '모델 목록 불러오기',
  refresh: '새로고침',
  update: '업데이트',
  saveKey: '키 저장',
  ollamaConnected: '🟢 연결됨',
  ollamaNotConnected: '🔴 미연결',

  // Errors
  errorApiKey: (provider: string): string => `${provider} API 키가 설정되지 않았습니다. "Vibe Flow: Set API Key"를 실행하세요.`,
  errorNetwork: '네트워크 오류가 발생했습니다. 연결 상태를 확인해 주세요.',
  errorRateLimit: '요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  errorUnknown: '알 수 없는 오류가 발생했습니다.',

  // Settings panel labels
  workspaceSettings: '워크스페이스 설정',
  aiRequestsWillUseThisProviderByDefault: 'AI 요청에서 기본적으로 이 프로바이더를 사용합니다',
  customInstructionsForTheAIAssistant: 'AI 어시스턴트를 위한 사용자 지정 명령어',
  maxTokensPerResponse: '응답당 최대 토큰',
  recommended: '권장',
  saveLocation: '저장 위치',
  workspace: '워크스페이스',
  global: '글로벌',
  workspaceSettingsDescription: '.vscode/settings.json (프로젝트 레벨)',
  globalSettingsDescription: '사용자 설정 (모든 프로젝트)',
  enterNewKey: '새 키 입력...',
  customSystemPromptOptional: '커스텀 시스템 프롬프트 입력... (선택사항)',
};

export default ko;
