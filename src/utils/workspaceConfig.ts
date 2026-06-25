import * as vscode from 'vscode';

/**
 * 워크스페이스 레벨 설정 구조
 */
export interface WorkspaceConfig {
  defaultProvider: 'claude' | 'openai' | 'gemini' | 'ollama';
  systemPrompt: string;
  maxTokensPerRequest: number;
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
    maxTokensPerRequest: config.get<number>('maxTokensPerRequest', 4096),
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
    if (
      event.affectsConfiguration('vibeflow.defaultProvider') ||
      event.affectsConfiguration('vibeflow.systemPrompt') ||
      event.affectsConfiguration('vibeflow.maxTokensPerRequest')
    ) {
      callback(getWorkspaceConfig());
    }
  });
}
