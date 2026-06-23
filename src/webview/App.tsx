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
  } = useChat();

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <header className="px-4 py-3 border-b border-gray-300 dark:border-gray-600 flex items-center justify-between gap-2">
        <span className="text-lg font-semibold">⚡ Vibe Flow</span>
        <ProviderSelector
          providers={providers}
          activeProvider={activeProvider}
          isStreaming={isStreaming}
          onSelect={selectProvider}
        />
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
