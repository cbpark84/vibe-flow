import React, { useMemo } from 'react';

interface DiffViewerProps {
  diff: string;
  filePath: string;
  isNewFile: boolean;
}

interface DiffLine {
  type: 'hunk' | 'add' | 'delete' | 'context' | 'file-header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

function parseDiff(diff: string): DiffLine[] {
  // Parse unified diff format into structured DiffLine objects
  const lines = diff.split('\n');
  const result: DiffLine[] = [];
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++')) {
      result.push({
        type: 'file-header',
        content: line,
      });
    } else if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
      result.push({
        type: 'hunk',
        content: line,
      });
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      result.push({
        type: 'add',
        content: line.slice(1),
        newLineNum,
      });
      newLineNum++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({
        type: 'delete',
        content: line.slice(1),
        oldLineNum,
      });
      oldLineNum++;
    } else if (line.startsWith(' ')) {
      result.push({
        type: 'context',
        content: line.slice(1),
        oldLineNum,
        newLineNum,
      });
      oldLineNum++;
      newLineNum++;
    }
  }

  return result;
}

export default function DiffViewer({
  diff,
  filePath,
  isNewFile,
}: DiffViewerProps): JSX.Element {
  const lines = useMemo(() => parseDiff(diff), [diff]);

  const addCount = useMemo(
    () => lines.filter(l => l.type === 'add').length,
    [lines]
  );

  const deleteCount = useMemo(
    () => lines.filter(l => l.type === 'delete').length,
    [lines]
  );

  return (
    <div className="rounded overflow-hidden border border-gray-200 dark:border-gray-700 mb-4">
      {/* File header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
            {filePath}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded font-semibold text-white ${
              isNewFile ? 'bg-green-500' : 'bg-blue-500'
            }`}
          >
            {isNewFile ? 'NEW FILE' : 'MODIFIED'}
          </span>
        </div>
        <div className="flex gap-3 text-xs">
          {addCount > 0 && (
            <span className="text-green-600 dark:text-green-400">+{addCount}</span>
          )}
          {deleteCount > 0 && (
            <span className="text-red-600 dark:text-red-400">-{deleteCount}</span>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div className="max-h-80 overflow-y-auto font-mono text-xs">
        {lines.map((line, idx) => {
          if (line.type === 'file-header') {
            return null;
          }

          if (line.type === 'hunk') {
            return (
              <div
                key={idx}
                className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-4 py-1 whitespace-pre-wrap break-words"
              >
                {line.content}
              </div>
            );
          }

          if (line.type === 'add') {
            return (
              <div
                key={idx}
                className="bg-green-50 dark:bg-green-950 flex whitespace-pre-wrap"
              >
                <div className="w-10 text-right pr-2 text-gray-400 dark:text-gray-600 select-none" />
                <div className="w-10 text-right pr-2 text-green-600 dark:text-green-400 select-none font-semibold">
                  {line.newLineNum}
                </div>
                <div className="w-4 text-center select-none text-green-600 dark:text-green-400">
                  +
                </div>
                <div className="font-mono text-xs whitespace-pre pl-2 flex-1 break-words text-green-900 dark:text-green-100">
                  {line.content}
                </div>
              </div>
            );
          }

          if (line.type === 'delete') {
            return (
              <div
                key={idx}
                className="bg-red-50 dark:bg-red-950 flex whitespace-pre-wrap"
              >
                <div className="w-10 text-right pr-2 text-red-600 dark:text-red-400 select-none font-semibold">
                  {line.oldLineNum}
                </div>
                <div className="w-10 text-right pr-2 text-gray-400 dark:text-gray-600 select-none" />
                <div className="w-4 text-center select-none text-red-600 dark:text-red-400">
                  -
                </div>
                <div className="font-mono text-xs whitespace-pre pl-2 flex-1 break-words text-red-900 dark:text-red-100">
                  {line.content}
                </div>
              </div>
            );
          }

          // context
          return (
            <div key={idx} className="bg-white dark:bg-gray-900 flex whitespace-pre-wrap">
              <div className="w-10 text-right pr-2 text-gray-400 dark:text-gray-600 select-none text-xs">
                {line.oldLineNum}
              </div>
              <div className="w-10 text-right pr-2 text-gray-400 dark:text-gray-600 select-none text-xs">
                {line.newLineNum}
              </div>
              <div className="w-4 text-center select-none" />
              <div className="font-mono text-xs whitespace-pre pl-2 flex-1 break-words text-gray-700 dark:text-gray-300">
                {line.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
