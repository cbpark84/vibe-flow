import React from 'react';

interface ToolApprovalProps {
  type: 'write_file' | 'run_terminal';
  filePath?: string;
  diff?: string;
  isNewFile?: boolean;
  command?: string;
  isDangerous?: boolean;
  dangerReason?: string;
  requestId: string;
  onApprove: () => void;
  onReject: () => void;
}

export default function ToolApproval({
  type,
  filePath,
  diff,
  isNewFile,
  command,
  isDangerous,
  dangerReason,
  onApprove,
  onReject,
}: ToolApprovalProps) {
  if (type === 'write_file') {
    return (
      <div className="mb-4 border border-gray-400 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-900 p-4">
        <div className="mb-2">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
            {isNewFile ? 'Create File' : 'Modify File'}
          </span>
          <div className="text-sm font-mono text-gray-700 dark:text-gray-300 mt-1">
            {filePath}
          </div>
        </div>

        {diff && (
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded font-mono text-xs mb-4 overflow-x-auto max-h-48 overflow-y-auto">
            {diff.split('\n').map((line, idx) => {
              let bgColor = '';
              let textColor = '';
              if (line.startsWith('+') && !line.startsWith('+++')) {
                bgColor = 'bg-green-100 dark:bg-green-900';
                textColor = 'text-green-900 dark:text-green-100';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                bgColor = 'bg-red-100 dark:bg-red-900';
                textColor = 'text-red-900 dark:text-red-100';
              }
              return (
                <div key={idx} className={`${bgColor} ${textColor} whitespace-pre-wrap break-words`}>
                  {line}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (type === 'run_terminal') {
    return (
      <div className="mb-4 border-l-4 border-red-500 bg-gray-50 dark:bg-gray-900 p-4 rounded">
        {isDangerous && dangerReason && (
          <div className="mb-3 p-2 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 rounded">
            <div className="text-xs font-semibold text-red-900 dark:text-red-100">⚠️ DANGEROUS COMMAND</div>
            <div className="text-xs text-red-800 dark:text-red-200 mt-1">{dangerReason}</div>
          </div>
        )}

        <div className="mb-3">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
            Run Terminal Command
          </span>
          <div className="bg-gray-800 text-gray-100 p-3 rounded font-mono text-sm mt-2 overflow-x-auto">
            {command}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onApprove}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  return null;
}
