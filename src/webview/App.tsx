import React, { useState } from 'react';
import { useChat } from './hooks/useChat';
import { useVSCode } from './hooks/useVSCode';
import ChatPanel from './components/ChatPanel';
import InputBar from './components/InputBar';
import ProviderSelector from './components/ProviderSelector';
import SettingsPanel, { WorkspaceConfig } from './components/SettingsPanel';

export default function App() {
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

  React.useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;

      if (message.type === 'workspace_config_init') {
        setWorkspaceConfig(message.payload);
      } else if (message.type === 'workspace_config_changed') {
        setWorkspaceConfig(message.payload);
      }
    };

    window.addEventListener('message', messageHandler);
    // 마운트 후 즉시 요청 (WebView 리스너 등록 후 Extension에서 응답 → race condition 방지)
    vscode.postMessage({ type: 'get_workspace_config' });
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className="px-4 py-3 border-b border-gray-300 dark:border-gray-600 flex items-center justify-between gap-2">
        <span className="text-lg font-semibold">⚡ Vibe Flow</span>
        <div className="flex items-center gap-2">
          <ProviderSelector
            providers={providers}
            activeProvider={activeProvider}
            isStreaming={isStreaming}
            onSelect={selectProvider}
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
          onClose={() => setShowSettings(false)}
          onSave={(newConfig, target) => {
            vscode.postMessage({
              type: 'save_workspace_config',
              payload: { config: newConfig, target },
            });
          }}
          onOpenVSCodeSettings={() => {
            vscode.postMessage({ type: 'open_settings' });
          }}
        />
      )}
    </div>
  );
}
