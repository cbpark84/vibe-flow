import React, { useState } from 'react';
import type { WorkspaceConfig } from '@shared/types';
import { useChat } from './hooks/useChat';
import { useVSCode } from './hooks/useVSCode';
import ChatPanel from './components/ChatPanel';
import InputBar from './components/InputBar';
import ProviderSelector from './components/ProviderSelector';
import SettingsPanel from './components/SettingsPanel';

export default function App(): React.ReactElement {
  const {
    messages,
    isStreaming,
    sendMessage,
    cancelStreaming,
    approveWriteFile,
    approveRunTerminal,
    providers,
    activeProvider,
    selectProvider,
    clearHistory,
  } = useChat();

  // useChat 내부에서 이미 획득된 싱글턴 인스턴스를 반환 (acquireVsCodeApi 재호출 없음)
  const vscode = useVSCode();

  const [showSettings, setShowSettings] = useState(false);
  const [workspaceConfig, setWorkspaceConfig] = useState<WorkspaceConfig | null>(null);
  const [apiKeyStatus, setApiKeyStatus] = useState<Record<string, boolean>>({});
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModelsError, setOllamaModelsError] = useState<string | undefined>();
  const [settingsInitialTab, setSettingsInitialTab] = useState<'general' | 'apikeys'>('general');

  React.useEffect((): (() => void) => {
    const messageHandler = (event: MessageEvent): void => {
      const message = event.data;

      if (message.type === 'workspace_config_init') {
        setWorkspaceConfig(message.payload);
      } else if (message.type === 'workspace_config_changed') {
        setWorkspaceConfig(message.payload);
      } else if (message.type === 'all_api_key_status') {
        setApiKeyStatus(message.payload.status);
      } else if (message.type === 'ollama_models') {
        setOllamaModels(message.payload.models ?? []);
        setOllamaModelsError(message.payload.error);
      }
    };

    window.addEventListener('message', messageHandler);
    // 마운트 후 즉시 요청 (WebView 리스너 등록 후 Extension에서 응답 → race condition 방지)
    vscode.postMessage({ type: 'get_workspace_config' });
    vscode.postMessage({ type: 'check_all_api_keys' });
    return (): void => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  const handleSelectProvider = (providerKey: string): void => {
    selectProvider(providerKey);
    // API 키 미등록 프로바이더 선택 시 API Keys 탭으로 자동 오픈
    if (apiKeyStatus[providerKey] === false) {
      setSettingsInitialTab('apikeys');
      setShowSettings(true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className="px-4 py-3 border-b border-gray-300 dark:border-gray-600 flex items-center justify-between gap-2">
        <span className="text-lg font-semibold">⚡ Vibe Flow</span>
        <div className="flex items-center gap-2">
          <ProviderSelector
            providers={providers}
            activeProvider={activeProvider}
            isStreaming={isStreaming}
            onSelect={handleSelectProvider}
          />
          <button
            onClick={() => setShowSettings(true)}
            disabled={isStreaming}
            title="Workspace settings"
            className="text-sm px-2 py-1 rounded border border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-600 dark:hover:border-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ⚙️
          </button>
          <button
            onClick={clearHistory}
            disabled={isStreaming || messages.length === 0}
            title="대화 내역 삭제"
            className="text-xs px-2 py-1 rounded border border-gray-400 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-red-500 hover:border-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Clear
          </button>
        </div>
      </header>
      <ChatPanel
        messages={messages}
        onApproveWriteFile={approveWriteFile}
        onApproveRunTerminal={approveRunTerminal}
      />
      <InputBar onSend={sendMessage} onCancel={cancelStreaming} isStreaming={isStreaming} />

      {/* Phase 4: Settings Panel */}
      {showSettings && (
        <SettingsPanel
          config={workspaceConfig}
          onClose={() => {
            setShowSettings(false);
            setSettingsInitialTab('general');
          }}
          onSave={(newConfig, target) => {
            vscode.postMessage({
              type: 'save_workspace_config',
              payload: { config: newConfig, target },
            });
          }}
          onOpenVSCodeSettings={() => {
            vscode.postMessage({ type: 'open_settings' });
          }}
          apiKeyStatus={apiKeyStatus}
          ollamaModels={ollamaModels}
          ollamaModelsError={ollamaModelsError}
          onSaveApiKey={(provider, apiKey) => {
            vscode.postMessage({ type: 'save_api_key', payload: { provider, apiKey } });
            vscode.postMessage({ type: 'check_all_api_keys' });
          }}
          onDeleteApiKey={(provider) => {
            vscode.postMessage({ type: 'delete_api_key', payload: { provider } });
          }}
          onGetOllamaModels={(url) => {
            vscode.postMessage({ type: 'get_ollama_models', payload: { url } });
          }}
          initialTab={settingsInitialTab}
        />
      )}
    </div>
  );
}
