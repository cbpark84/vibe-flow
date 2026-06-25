import React from 'react';

/**
 * 워크스페이스 레벨 설정 구조 (Extension과 동일)
 */
export interface WorkspaceConfig {
  defaultProvider: 'claude' | 'openai' | 'gemini' | 'ollama';
  systemPrompt: string;
  maxTokensPerRequest: number;
}

interface SettingsPanelProps {
  config: WorkspaceConfig | null;
  onClose: () => void;
  onOpenVSCodeSettings: () => void;
}

/**
 * 워크스페이스 설정을 표시하고 관리하는 패널.
 * 사용자가 VSCode 설정 UI에서 직접 수정하거나
 * .vscode/settings.json에 직접 추가할 수 있도록 안내한다.
 */
export default function SettingsPanel({
  config,
  onClose,
  onOpenVSCodeSettings,
}: SettingsPanelProps) {
  if (!config) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-end sm:justify-center">
      <div className="bg-white dark:bg-gray-800 w-full sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-lg sm:rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>⚙️</span>
            <span>Workspace Settings</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-8">
          {/* Default Provider */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Default Provider
            </h3>
            <div className="flex items-center gap-2">
              <span className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-full text-sm font-medium">
                {config.defaultProvider}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                AI requests will use this provider by default
              </span>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              System Prompt
            </h3>
            {config.systemPrompt.trim() ? (
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-300 max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono">
                {config.systemPrompt}
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                Default system prompt in use
              </div>
            )}
          </div>

          {/* Max Tokens Per Request */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Max Tokens Per Request
            </h3>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {config.maxTokensPerRequest.toLocaleString()}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Maximum response tokens for AI requests
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 dark:border-gray-600" />

          {/* Instructions */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              How to Change Settings
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Modify settings in VSCode preferences or add them to <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono">.vscode/settings.json</code>:
            </p>

            {/* Code Example */}
            <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded text-xs overflow-x-auto font-mono border border-gray-700">
              <pre>{`{
  "vibeflow.defaultProvider": "claude",
  "vibeflow.systemPrompt": "You are a helpful assistant.",
  "vibeflow.maxTokensPerRequest": 4096
}`}</pre>
            </div>
          </div>

          {/* Open Settings Button */}
          <div>
            <button
              onClick={onOpenVSCodeSettings}
              className="w-full px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 font-medium text-sm transition-colors"
            >
              Open VSCode Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
