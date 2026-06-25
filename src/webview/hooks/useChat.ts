import { useState, useCallback, useEffect } from 'react';
import type { ExtensionToWebviewMessage, ProviderInfo } from '@shared/types';
import { useVSCode } from './useVSCode';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'error';
  content: string;
  toolName?: string;
  requestId?: string;
  isDangerous?: boolean;
  dangerReason?: string;
  diff?: string;
  isNewFile?: boolean;
  command?: string;
  errorType?: string;
  retryable?: boolean;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProvider, setActiveProvider] = useState<string>('claude');
  const vscode = useVSCode();

  // 마운트 시 Extension에 프로바이더 목록 및 히스토리 요청
  useEffect(() => {
    vscode.postMessage({ type: 'get_provider_list' });
    vscode.postMessage({ type: 'get_history' }); // Phase 3: 히스토리 로드
  }, [vscode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'stream_chunk': {
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, content: lastMsg.content + message.payload.content },
              ];
            }
            return [
              ...prev,
              {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: message.payload.content,
              },
            ];
          });
          break;
        }
        case 'stream_end': {
          setIsStreaming(false);
          break;
        }
        case 'stream_error': {
          setIsStreaming(false);
          const { message: errorMsg, errorType, retryable } = message.payload as {
            message: string;
            errorType?: string;
            retryable?: boolean;
          };
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'error',
              content: errorMsg,
              errorType,
              retryable,
            },
          ]);
          break;
        }
        case 'request_write_file': {
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'tool',
              content: '',
              toolName: 'write_file',
              requestId: message.payload.requestId,
              diff: message.payload.diff,
              isNewFile: message.payload.isNewFile,
            },
          ]);
          break;
        }
        case 'request_run_terminal': {
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'tool',
              content: '',
              toolName: 'run_terminal',
              requestId: message.payload.requestId,
              command: message.payload.command,
              isDangerous: message.payload.isDangerous,
              dangerReason: message.payload.dangerReason,
            },
          ]);
          break;
        }
        case 'tool_result': {
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'tool',
              content: message.payload.output || '',
              toolName: message.payload.toolName,
              requestId: message.payload.requestId,
            },
          ]);
          break;
        }
        case 'api_key_status': {
          if (!message.payload.exists) {
            // API 키 없음 알림 메시지 표시
            setMessages(prev => [
              ...prev,
              {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: `⚠️ ${message.payload.provider} API 키가 설정되지 않았습니다. "Vibe Flow: Set API Key" 명령을 실행하세요.`,
              },
            ]);
          }
          break;
        }
        case 'error': {
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: `Error: ${message.payload.message}`,
            },
          ]);
          break;
        }
        case 'provider_list': {
          setProviders(message.payload.providers);
          setActiveProvider(message.payload.activeProvider);
          break;
        }
        case 'provider_changed': {
          setActiveProvider(message.payload.provider);
          break;
        }
        case 'history_loaded': {
          // Phase 3: 저장된 히스토리 로드
          setMessages(
            message.payload.messages.map((m, i) => ({
              id: `history-${i}`,
              role: m.role,
              content: m.content,
            }))
          );
          break;
        }
        case 'history_cleared': {
          // Phase 3: 히스토리 삭제됨
          setMessages([]);
          break;
        }
        case 'approval_timeout': {
          const { requestId, message: timeoutMsg } = message.payload as {
            requestId: string;
            message: string;
          };
          setMessages(prev => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              role: 'error',
              content: timeoutMsg,
              requestId,
            },
          ]);
          break;
        }
      }
    };

    window.addEventListener('message', handleMessage as EventListener);
    return () => {
      window.removeEventListener('message', handleMessage as EventListener);
    };
  }, [vscode]);

  const sendMessage = useCallback(
    (content: string) => {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          role: 'user',
          content,
        },
      ]);
      setIsStreaming(true);
      vscode.postMessage({
        type: 'chat_send',
        payload: { message: content, attachedFiles: [] },
      });
    },
    [vscode]
  );

  const cancelStreaming = useCallback(() => {
    setIsStreaming(false);
    vscode.postMessage({ type: 'chat_abort' });
  }, [vscode]);

  const approveWriteFile = useCallback(
    (requestId: string, approved: boolean) => {
      vscode.postMessage({
        type: 'approve_write_file',
        payload: { requestId, approved },
      });
    },
    [vscode]
  );

  const approveRunTerminal = useCallback(
    (requestId: string, approved: boolean) => {
      vscode.postMessage({
        type: 'approve_run_terminal',
        payload: { requestId, approved },
      });
    },
    [vscode]
  );

  const selectProvider = useCallback(
    (key: string) => {
      vscode.postMessage({ type: 'select_provider', payload: { provider: key } });
    },
    [vscode]
  );

  const clearHistory = useCallback(() => {
    // Phase 3: 히스토리 삭제 요청
    vscode.postMessage({ type: 'clear_history' });
  }, [vscode]);

  return {
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
  };
}
