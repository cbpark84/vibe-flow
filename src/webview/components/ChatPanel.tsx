import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../hooks/useChat';
import MessageBubble from './MessageBubble';
import ToolApproval from './ToolApproval';

interface ChatPanelProps {
  messages: ChatMessage[];
  onApproveWriteFile: (requestId: string, approved: boolean) => void;
  onApproveRunTerminal: (requestId: string, approved: boolean) => void;
}

export default function ChatPanel({
  messages,
  onApproveWriteFile,
  onApproveRunTerminal,
}: ChatPanelProps): React.ReactElement {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map(msg => {
        if (msg.toolName === 'write_file' && msg.diff) {
          return (
            <ToolApproval
              key={msg.id}
              type="write_file"
              filePath={msg.content}
              diff={msg.diff}
              isNewFile={msg.isNewFile || false}
              requestId={msg.requestId || ''}
              onApprove={() =>
                onApproveWriteFile(msg.requestId || '', true)
              }
              onReject={() =>
                onApproveWriteFile(msg.requestId || '', false)
              }
            />
          );
        }

        if (msg.toolName === 'run_terminal' && msg.command) {
          return (
            <ToolApproval
              key={msg.id}
              type="run_terminal"
              command={msg.command}
              isDangerous={msg.isDangerous || false}
              dangerReason={msg.dangerReason}
              requestId={msg.requestId || ''}
              onApprove={() =>
                onApproveRunTerminal(msg.requestId || '', true)
              }
              onReject={() =>
                onApproveRunTerminal(msg.requestId || '', false)
              }
            />
          );
        }

        return (
          <MessageBubble key={msg.id} message={msg} />
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
