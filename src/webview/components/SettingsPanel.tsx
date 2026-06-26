import React, { useState } from 'react';

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
  onSave: (config: WorkspaceConfig, target: 'workspace' | 'global') => void;
  onOpenVSCodeSettings: () => void;
}

/**
 * 워크스페이스 설정을 인라인으로 편집하고 저장하는 패널.
 * 사용자가 Workspace/Global 저장 대상을 선택하여 직접 수정할 수 있다.
 */
export default function SettingsPanel({
  config,
  onClose,
  onSave,
  onOpenVSCodeSettings,
}: SettingsPanelProps) {
  if (!config) {
    return null;
  }

  const [draft, setDraft] = useState<WorkspaceConfig>({
    defaultProvider: config.defaultProvider,
    systemPrompt: config.systemPrompt,
    maxTokensPerRequest: config.maxTokensPerRequest,
  });

  const [saveTarget, setSaveTarget] = useState<'workspace' | 'global'>('workspace');

  const handleSave = () => {
    onSave(draft, saveTarget);
    onClose();
  };

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
        <div className="px-6 py-6 space-y-6">
          {/* Default Provider */}
          <div>
            <label htmlFor="provider-select" className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block">
              Default Provider
            </label>
            <select
              id="provider-select"
              value={draft.defaultProvider}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  defaultProvider: e.target.value as 'claude' | 'openai' | 'gemini' | 'ollama',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="ollama">Ollama</option>
            </select>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              AI requests will use this provider by default
            </p>
          </div>

          {/* System Prompt */}
          <div>
            <label htmlFor="system-prompt-area" className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block">
              System Prompt
            </label>
            <textarea
              id="system-prompt-area"
              value={draft.systemPrompt}
              onChange={(e) => setDraft({ ...draft, systemPrompt: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter custom system prompt (optional)"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Custom instructions for the AI assistant
            </p>
          </div>

          {/* Max Tokens Per Request */}
          <div>
            <label htmlFor="max-tokens-input" className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block">
              Max Tokens Per Request
            </label>
            <input
              id="max-tokens-input"
              type="number"
              min="256"
              max="32768"
              step="256"
              value={draft.maxTokensPerRequest}
              onChange={(e) =>
                setDraft({ ...draft, maxTokensPerRequest: parseInt(e.target.value, 10) || 4096 })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Maximum response tokens for AI requests (256-32768)
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 dark:border-gray-600" />

          {/* Save Target Toggle */}
          <div>
            <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 block">
              Save Location
            </label>
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setSaveTarget('workspace')}
                className={`flex-1 px-4 py-2 rounded border-2 text-sm font-medium transition-colors ${
                  saveTarget === 'workspace'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                Workspace
              </button>
              <button
                onClick={() => setSaveTarget('global')}
                className={`flex-1 px-4 py-2 rounded border-2 text-sm font-medium transition-colors ${
                  saveTarget === 'global'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                Global
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
              <div>
                <p className="font-medium mb-1">Workspace</p>
                <p>.vscode/settings.json (project-level)</p>
              </div>
              <div>
                <p className="font-medium mb-1">Global</p>
                <p>User settings (all projects)</p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 dark:border-gray-600" />

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded font-medium text-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded font-medium text-sm hover:border-gray-400 dark:hover:border-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>

          {/* Open VSCode Settings Button */}
          <button
            onClick={onOpenVSCodeSettings}
            className="w-full px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium transition-colors"
          >
            Open VSCode Settings
          </button>
        </div>
      </div>
    </div>
  );
}
