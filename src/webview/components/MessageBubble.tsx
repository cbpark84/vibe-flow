import React from 'react';
import type { ChatMessage } from '../hooks/useChat';

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps): React.ReactElement | null {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-blue-500 text-white rounded-lg px-4 py-2 max-w-xs lg:max-w-md">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg px-4 py-2 max-w-xs lg:max-w-md whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'error') {
    return (
      <div className="flex justify-start mb-4">
        <div className="max-w-xs lg:max-w-md rounded-lg px-4 py-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-sm mt-0.5">⚠️</span>
            <div className="flex-1">
              <p className="text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">
                {message.content}
              </p>
              {message.retryable && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">
                  💡 잠시 후 다시 시도해 주세요.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-gray-100 dark:bg-gray-800 border-l-4 border-gray-400 dark:border-gray-600 px-4 py-2 max-w-xs lg:max-w-md">
          {message.toolName && (
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Tool: {message.toolName}
            </div>
          )}
          {message.content && (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {message.content}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
