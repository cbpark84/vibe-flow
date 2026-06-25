import React from 'react';
import { useChat } from './hooks/useChat';
import ChatPanel from './components/ChatPanel';
import InputBar from './components/InputBar';
import ProviderSelector from './components/ProviderSelector';

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
      <InputBar
        onSend={sendMessage}
        onCancel={cancelStreaming}
        isStreaming={isStreaming}
      />
    </div>
  );
}
