import React, { useState } from 'react';
import type { WorkspaceConfig } from '@shared/types';

const PROVIDER_TOKEN_CONFIGS: Record<
  string,
  {
    min: number;
    max: number;
    default: number;
    step: number;
    label: string;
  }
> = {
  claude: {
    min: 256,
    max: 16384,
    default: 4096,
    step: 256,
    label: 'Claude (Opus 4.5)',
  },
  openai: {
    min: 256,
    max: 4096,
    default: 2048,
    step: 256,
    label: 'OpenAI (GPT-4o)',
  },
  gemini: {
    min: 256,
    max: 8192,
    default: 2048,
    step: 256,
    label: 'Gemini (1.5 Pro)',
  },
  ollama: {
    min: 256,
    max: 4096,
    default: 2048,
    step: 256,
    label: 'Ollama (local)',
  },
};

interface SettingsPanelProps {
  config: WorkspaceConfig | null;
  onClose: () => void;
  onSave: (config: WorkspaceConfig, target: 'workspace' | 'global') => void;
  onOpenVSCodeSettings: () => void;
  apiKeyStatus: Record<string, boolean>;
  ollamaModels: string[];
  ollamaModelsError?: string;
  onSaveApiKey: (provider: string, apiKey: string) => void;
  onDeleteApiKey: (provider: string) => void;
  onGetOllamaModels: (url: string) => void;
  initialTab?: 'general' | 'apikeys';
}

export default function SettingsPanel({
  config,
  onClose,
  onSave,
  onOpenVSCodeSettings,
  apiKeyStatus,
  ollamaModels,
  ollamaModelsError,
  onSaveApiKey,
  onDeleteApiKey,
  onGetOllamaModels,
  initialTab = 'general',
}: SettingsPanelProps) {
  if (!config) {
    return null;
  }

  const [activeTab, setActiveTab] = useState<'general' | 'apikeys'>(initialTab);
  const [saveTarget, setSaveTarget] = useState<'workspace' | 'global'>('workspace');

  const [draft, setDraft] = useState<WorkspaceConfig>({
    defaultProvider: config.defaultProvider,
    systemPrompt: config.systemPrompt,
    claudeMaxTokens: config.claudeMaxTokens ?? 4096,
    openaiMaxTokens: config.openaiMaxTokens ?? 2048,
    geminiMaxTokens: config.geminiMaxTokens ?? 2048,
    ollamaMaxTokens: config.ollamaMaxTokens ?? 2048,
    ollamaUrl: config.ollamaUrl ?? 'http://localhost:11434',
    ollamaModel: config.ollamaModel ?? 'llama3.2',
  });

  // API Keys 탭: 입력 필드 표시 토글
  const [showKeyInput, setShowKeyInput] = useState<Record<string, boolean>>({});
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});

  const handleSave = () => {
    onSave(draft, saveTarget);
    onClose();
  };

  const handleSaveApiKey = (provider: string) => {
    const key = keyInputs[provider]?.trim();
    if (key) {
      onSaveApiKey(provider, key);
      setKeyInputs({ ...keyInputs, [provider]: '' });
      setShowKeyInput({ ...showKeyInput, [provider]: false });
    }
  };

  const handleDeleteApiKey = (provider: string) => {
    onDeleteApiKey(provider);
    setKeyInputs({ ...keyInputs, [provider]: '' });
    setShowKeyInput({ ...showKeyInput, [provider]: false });
  };

  const handleRefreshOllamaModels = () => {
    const url = draft.ollamaUrl.trim();
    if (url) {
      onGetOllamaModels(url);
    }
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

        {/* Tabs */}
        <div className="flex border-b border-gray-300 dark:border-gray-600 px-6 bg-white dark:bg-gray-800">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            ⚙️ General
          </button>
          <button
            onClick={() => setActiveTab('apikeys')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'apikeys'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            🔑 API Keys
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Default Provider */}
              <div>
                <label
                  htmlFor="provider-select"
                  className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block"
                >
                  Default Provider
                </label>
                <select
                  id="provider-select"
                  value={draft.defaultProvider}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      defaultProvider: e.target.value as
                        | 'claude'
                        | 'openai'
                        | 'gemini'
                        | 'ollama',
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
                <label
                  htmlFor="system-prompt-area"
                  className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 block"
                >
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

              {/* Max Tokens Sliders */}
              <div className="border-t border-gray-300 dark:border-gray-600 pt-6">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Max Tokens per Response
                </h3>
                <div className="space-y-4">
                  {Object.entries(PROVIDER_TOKEN_CONFIGS).map(([provider, config]) => {
                    const draftKey = `${provider}MaxTokens` as keyof WorkspaceConfig;
                    const currentValue = (draft[draftKey] as number) || config.default;

                    return (
                      <div key={provider} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor={`slider-${provider}`}
                            className="text-xs font-medium text-gray-700 dark:text-gray-300"
                          >
                            {config.label}
                          </label>
                          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {currentValue}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{config.min}</span>
                          <input
                            id={`slider-${provider}`}
                            type="range"
                            min={config.min}
                            max={config.max}
                            step={config.step}
                            value={currentValue}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                [draftKey]: parseInt(e.target.value, 10),
                              })
                            }
                            className="flex-1"
                            aria-label={`Max tokens for ${config.label}`}
                          />
                          <span className="text-xs text-gray-500">{config.max}</span>
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                          recommended: {config.default}
                        </div>
                      </div>
                    );
                  })}
                </div>
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
          )}

          {activeTab === 'apikeys' && (
            <div className="space-y-4">
              {/* Claude */}
              <ApiKeySection
                provider="claude"
                label="Claude"
                status={apiKeyStatus.claude}
                showInput={showKeyInput.claude}
                onToggleInput={() =>
                  setShowKeyInput({
                    ...showKeyInput,
                    claude: !showKeyInput.claude,
                  })
                }
                inputValue={keyInputs.claude || ''}
                onInputChange={(value) =>
                  setKeyInputs({ ...keyInputs, claude: value })
                }
                onSave={() => handleSaveApiKey('claude')}
                onDelete={() => handleDeleteApiKey('claude')}
              />

              {/* OpenAI */}
              <ApiKeySection
                provider="openai"
                label="OpenAI"
                status={apiKeyStatus.openai}
                showInput={showKeyInput.openai}
                onToggleInput={() =>
                  setShowKeyInput({
                    ...showKeyInput,
                    openai: !showKeyInput.openai,
                  })
                }
                inputValue={keyInputs.openai || ''}
                onInputChange={(value) =>
                  setKeyInputs({ ...keyInputs, openai: value })
                }
                onSave={() => handleSaveApiKey('openai')}
                onDelete={() => handleDeleteApiKey('openai')}
              />

              {/* Gemini */}
              <ApiKeySection
                provider="gemini"
                label="Gemini"
                status={apiKeyStatus.gemini}
                showInput={showKeyInput.gemini}
                onToggleInput={() =>
                  setShowKeyInput({
                    ...showKeyInput,
                    gemini: !showKeyInput.gemini,
                  })
                }
                inputValue={keyInputs.gemini || ''}
                onInputChange={(value) =>
                  setKeyInputs({ ...keyInputs, gemini: value })
                }
                onSave={() => handleSaveApiKey('gemini')}
                onDelete={() => handleDeleteApiKey('gemini')}
              />

              {/* Ollama */}
              <div className="border rounded-lg p-4 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Ollama
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    ollamaModelsError
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                      : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  }`}>
                    {ollamaModelsError ? '🔴 Not connected' : '🟢 Connected'}
                  </span>
                </div>

                {ollamaModelsError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                    ⚠️ {ollamaModelsError}
                  </p>
                )}

                <div className="space-y-3">
                  {/* URL */}
                  <div>
                    <label
                      htmlFor="ollama-url"
                      className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1"
                    >
                      URL
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="ollama-url"
                        type="text"
                        value={draft.ollamaUrl}
                        onChange={(e) =>
                          setDraft({ ...draft, ollamaUrl: e.target.value })
                        }
                        className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="http://localhost:11434"
                      />
                      <button
                        onClick={handleRefreshOllamaModels}
                        className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-xs font-medium hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {/* Model Dropdown */}
                  <div>
                    <label
                      htmlFor="ollama-model"
                      className="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-1"
                    >
                      Model
                    </label>
                    <select
                      id="ollama-model"
                      value={draft.ollamaModel}
                      onChange={(e) =>
                        setDraft({ ...draft, ollamaModel: e.target.value })
                      }
                      className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {ollamaModels.length === 0 ? (
                        <option value={draft.ollamaModel}>
                          {draft.ollamaModel}
                        </option>
                      ) : (
                        ollamaModels.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ApiKeySectionProps {
  provider: string;
  label: string;
  status?: boolean;
  showInput: boolean;
  onToggleInput: () => void;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}

function ApiKeySection({
  label,
  status,
  showInput,
  onToggleInput,
  inputValue,
  onInputChange,
  onSave,
  onDelete,
}: ApiKeySectionProps) {
  const isConfigured = status === true;

  return (
    <div className="border rounded-lg p-4 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </span>
        <span className={`text-xs px-2 py-1 rounded ${
          isConfigured
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
        }`}>
          {isConfigured ? '✅ Configured' : '⚠️ Not configured'}
        </span>
      </div>

      {!isConfigured || showInput ? (
        <div className="space-y-2 mb-3">
          <input
            type="password"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Enter new key..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        {isConfigured && !showInput ? (
          <>
            <button
              onClick={onToggleInput}
              className="flex-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              Update
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onSave}
              className="flex-1 px-3 py-1 bg-green-600 dark:bg-green-700 text-white rounded text-xs font-medium hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
            >
              Save Key
            </button>
            {isConfigured && (
              <button
                onClick={onToggleInput}
                className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded text-xs font-medium hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
