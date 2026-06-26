import React from 'react';
import type { ProviderInfo } from '@shared/types';

interface ProviderSelectorProps {
  providers: ProviderInfo[];
  activeProvider: string;
  isStreaming: boolean;
  onSelect: (providerKey: string) => void;
}

/**
 * 헤더에 위치하는 프로바이더 드롭다운.
 * 스트리밍 중에는 disabled 처리.
 */
export default function ProviderSelector({
  providers,
  activeProvider,
  isStreaming,
  onSelect,
}: ProviderSelectorProps): React.ReactElement {
  const active = providers.find(p => p.key === activeProvider);

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeProvider}
        disabled={isStreaming}
        onChange={(e) => onSelect(e.target.value)}
        className="text-sm bg-transparent border border-gray-400 dark:border-gray-600 rounded px-2 py-1 focus:outline-none disabled:opacity-50"
        aria-label="AI Provider"
      >
        {providers.map((p) => (
          <option key={p.key} value={p.key}>
            {p.displayName}
          </option>
        ))}
      </select>
      {active && (
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
          {active.modelName}
        </span>
      )}
    </div>
  );
}
