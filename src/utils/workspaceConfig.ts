import * as vscode from 'vscode';

/**
 * 워크스페이스 레벨 설정 구조
 */
export interface WorkspaceConfig {
  defaultProvider: 'claude' | 'openai' | 'gemini' | 'ollama';
  systemPrompt: string;
  claudeMaxTokens: number;
  openaiMaxTokens: number;
  geminiMaxTokens: number;
  ollamaMaxTokens: number;
  ollamaUrl: string;
  ollamaModel: string;
}

/**
 * 현재 워크스페이스 설정을 읽어 반환한다.
 * .vscode/settings.json > 사용자 설정 > 기본값 순으로 적용된다.
 */
export function getWorkspaceConfig(): WorkspaceConfig {
  const config = vscode.workspace.getConfiguration('vibeflow');
  return {
    defaultProvider: config.get<WorkspaceConfig['defaultProvider']>('defaultProvider', 'claude'),
    systemPrompt: config.get<string>('systemPrompt', ''),
    claudeMaxTokens: config.get<number>('claudeMaxTokens', 4096),
    openaiMaxTokens: config.get<number>('openaiMaxTokens', 2048),
    geminiMaxTokens: config.get<number>('geminiMaxTokens', 2048),
    ollamaMaxTokens: config.get<number>('ollamaMaxTokens', 2048),
    ollamaUrl: config.get<string>('ollamaUrl', 'http://localhost:11434'),
    ollamaModel: config.get<string>('ollamaModel', 'llama3.2'),
  };
}

/**
 * 설정 변경 시 콜백을 호출하는 리스너를 등록한다.
 * extension.ts의 context.subscriptions에 push해서 자동 해제된다.
 */
export function onWorkspaceConfigChange(
  callback: (config: WorkspaceConfig) => void
): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(event => {
    if (event.affectsConfiguration('vibeflow')) {
      callback(getWorkspaceConfig());
    }
  });
}
