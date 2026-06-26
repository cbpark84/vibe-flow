import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ILLMProvider, ChatMessage, Tool } from './providers/base';
import { createProvider, ProviderConfig } from './providers/factory';
import { initializeSecretStorage, getSecret, setSecret, deleteSecret } from './utils/secretStorage';
import { getLogger } from './utils/logger';
import { ContextManager } from './utils/contextManager';
import { parseProviderError } from './utils/errorHandler';
import {
  WebviewToExtMessage,
  ExtensionToWebviewMessage,
  ProviderInfo,
} from './utils/types';
import { getWorkspaceConfig, onWorkspaceConfigChange, WorkspaceConfig } from './utils/workspaceConfig';
import * as fileSystem from './tools/fileSystem';
import * as terminal from './tools/terminal';

const logger = getLogger('Extension');

let provider: ILLMProvider | null = null;
let abortController: AbortController | null = null;

// Phase 3: ExtensionContext를 모듈 레벨에서 접근하기 위한 참조
let extensionContext: vscode.ExtensionContext | null = null;
const HISTORY_STATE_KEY = 'vibeflow.conversationHistory';

// Phase 2: 현재 활성 프로바이더 키 (기본값: 'claude')
let activeProviderKey = 'claude';

// Phase 4: 워크스페이스 설정
let workspaceConfig: WorkspaceConfig = getWorkspaceConfig();

// WebviewViewProvider 참조 (sendMessage에서 사용)
let viewProvider: VibeFlowViewProvider | null = null;

const PROVIDER_LIST: ProviderInfo[] = [
  { key: 'claude', displayName: 'Claude', modelName: 'claude-opus-4-5', requiresApiKey: true },
  { key: 'openai', displayName: 'OpenAI', modelName: 'gpt-4o',          requiresApiKey: true },
  { key: 'gemini', displayName: 'Gemini', modelName: 'gemini-1.5-pro',  requiresApiKey: true },
  { key: 'ollama', displayName: 'Ollama', modelName: 'llama3.2',        requiresApiKey: false },
];

// Persistent conversation history across multiple sends
const conversationHistory: ChatMessage[] = [];

// Tool definitions exposed to the LLM
const TOOLS: Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file at the given path.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Absolute or workspace-relative path to the file' },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Shows a diff preview and requires user approval before writing.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file to create or overwrite' },
        content: { type: 'string', description: 'Full content to write to the file' },
      },
      required: ['file_path', 'content'],
    },
  },
  {
    name: 'run_terminal',
    description: 'Run a shell command in the terminal. Requires user approval. Dangerous commands (rm -rf, sudo, etc.) are flagged.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command to execute' },
      },
      required: ['command'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories in a directory. Returns each entry prefixed with "file:" or "dir:".',
    inputSchema: {
      type: 'object',
      properties: {
        dir_path: { type: 'string', description: 'Path to the directory to list' },
      },
      required: ['dir_path'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for a regex pattern across all files in the workspace. Returns matching lines with file path and line number.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'Regex or literal string to search for' },
        include: { type: 'string', description: 'Glob pattern to filter files (e.g. "**/*.ts"). Defaults to all files.' },
        max_results: { type: 'string', description: 'Maximum number of results to return (default: 50)' },
      },
      required: ['pattern'],
    },
  },
];

/**
 * 사이드바 WebView 패널을 제공하는 Provider.
 * VSCode Activity Bar 아이콘 클릭 시 resolveWebviewView가 호출된다.
 * 보조 사이드바로 드래그해도 동일하게 동작한다.
 */
class VibeFlowViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'vibeflow.chatView';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._view = webviewView;

    // WebView 옵션: 스크립트 허용 + 리소스 루트 설정
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview'),
      ],
    };

    webviewView.webview.html = getWebviewContent(this.context, webviewView.webview);

    // 초기 워크스페이스 설정 전송
    webviewView.webview.postMessage({
      type: 'workspace_config_init',
      payload: workspaceConfig,
    });

    // WebView → Extension 메시지 수신
    webviewView.webview.onDidReceiveMessage(
      async (message: WebviewToExtMessage) => {
        await handleWebviewMessage(message);
      },
      undefined,
      this.context.subscriptions,
    );
  }

  /** Extension → WebView 메시지 전송 */
  public postMessage(message: ExtensionToWebviewMessage): void {
    this._view?.webview.postMessage(message).catch((err: Error) => logger.error(err));
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  logger.info('Activating Vibe Flow extension');

  initializeSecretStorage(context.secrets);

  // Phase 3: 컨텍스트 저장
  extensionContext = context;

  // Phase 3: 저장된 히스토리 복원
  const savedHistory = context.globalState.get<ChatMessage[]>(HISTORY_STATE_KEY, []);
  if (savedHistory.length > 0) {
    conversationHistory.push(...savedHistory);
    logger.info(`Restored ${savedHistory.length} messages from history`);
  }

  // WebviewViewProvider 등록 (사이드바 아이콘과 연결)
  viewProvider = new VibeFlowViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      VibeFlowViewProvider.viewType,
      viewProvider,
      {
        // 사이드바가 숨겨져 있어도 WebView 상태를 유지
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );

  // Phase 4: 워크스페이스 설정 변경 리스너 등록
  const configChangeListener = onWorkspaceConfigChange((newConfig) => {
    // Ollama URL이나 모델이 바뀌면 프로바이더 재초기화 필요
    if (
      activeProviderKey === 'ollama' &&
      (newConfig.ollamaUrl !== workspaceConfig.ollamaUrl ||
       newConfig.ollamaModel !== workspaceConfig.ollamaModel)
    ) {
      provider = null; // 다음 chat_send 때 재초기화
    }
    workspaceConfig = newConfig;
    sendMessage({
      type: 'workspace_config_changed',
      payload: newConfig,
    });
  });
  context.subscriptions.push(configChangeListener);

  // vibeflow.openChat: 사이드바 뷰 포커스
  context.subscriptions.push(
    vscode.commands.registerCommand('vibeflow.openChat', async () => {
      await vscode.commands.executeCommand('vibeflow.chatView.focus');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('vibeflow.setApiKey', async () => {
      await setApiKeyCommand();
    })
  );

  // Phase 3: 히스토리 삭제 커맨드
  context.subscriptions.push(
    vscode.commands.registerCommand('vibeflow.clearHistory', async () => {
      conversationHistory.length = 0;
      await context.globalState.update(HISTORY_STATE_KEY, []);
      sendMessage({ type: 'history_cleared' });
      vscode.window.showInformationMessage('Vibe Flow: 채팅 히스토리가 삭제되었습니다.');
    })
  );
}

export async function deactivate(): Promise<void> {
  logger.info('Deactivating Vibe Flow extension');
  if (abortController) {
    abortController.abort();
  }
}

async function handleWebviewMessage(message: WebviewToExtMessage): Promise<void> {
  try {
    switch (message.type) {
      case 'chat_send': {
        await handleChatSend(message.payload.message, message.payload.attachedFiles);
        break;
      }
      case 'chat_abort': {
        if (abortController) {
          abortController.abort();
          abortController = new AbortController();
        }
        break;
      }
      case 'approve_write_file': {
        await fileSystem.handleApproveWriteFile(
          message.payload.requestId,
          message.payload.approved
        );
        break;
      }
      case 'approve_run_terminal': {
        await terminal.handleApproveTerminal(
          message.payload.requestId,
          message.payload.approved
        );
        break;
      }
      case 'save_api_key': {
        await setSecret(`${message.payload.provider}-api-key`, message.payload.apiKey);
        // Reset provider if active provider's key changed so new key takes effect on next chat
        if (message.payload.provider === activeProviderKey) {
          provider = null;
        }
        sendMessage({
          type: 'api_key_status',
          payload: { provider: message.payload.provider, exists: true },
        });
        break;
      }
      case 'check_api_key': {
        const exists = !!(await getSecret(`${message.payload.provider}-api-key`));
        sendMessage({
          type: 'api_key_status',
          payload: { provider: message.payload.provider, exists },
        });
        break;
      }
      case 'delete_api_key': {
        await deleteSecret(`${message.payload.provider}-api-key`);
        // Reset provider if active provider's key was deleted
        if (message.payload.provider === activeProviderKey) {
          provider = null;
        }
        // 삭제 후 전체 상태 재확인해서 전송
        const status: Record<string, boolean> = {};
        for (const p of PROVIDER_LIST) {
          status[p.key] = p.requiresApiKey
            ? !!(await getSecret(`${p.key}-api-key`))
            : true;
        }
        sendMessage({ type: 'all_api_key_status', payload: { status } });
        break;
      }
      case 'get_ollama_models': {
        const baseUrl = message.payload.url ?? workspaceConfig.ollamaUrl;
        try {
          const response = await fetch(`${baseUrl}/api/tags`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json() as { models?: Array<{ name: string }> };
          const models = (data.models ?? []).map(m => m.name);
          sendMessage({ type: 'ollama_models', payload: { models } });
        } catch (e) {
          sendMessage({
            type: 'ollama_models',
            payload: { models: [], error: `Ollama에 연결할 수 없습니다: ${(e as Error).message}` },
          });
        }
        break;
      }
      case 'check_all_api_keys': {
        const status: Record<string, boolean> = {};
        for (const p of PROVIDER_LIST) {
          status[p.key] = p.requiresApiKey
            ? !!(await getSecret(`${p.key}-api-key`))
            : true;
        }
        sendMessage({ type: 'all_api_key_status', payload: { status } });
        break;
      }
      case 'select_provider': {
        await handleSelectProvider(message.payload.provider);
        break;
      }
      case 'get_provider_list': {
        sendMessage({
          type: 'provider_list',
          payload: { providers: PROVIDER_LIST, activeProvider: activeProviderKey },
        });
        break;
      }
      case 'get_history': {
        // Phase 3: user/assistant 텍스트 메시지만 WebView 표시용으로 변환 (tool 블록 제외)
        const displayMessages = conversationHistory
          .filter(m =>
            (m.role === 'user' || m.role === 'assistant') &&
            !m.toolCallId &&
            m.content.trim() !== ''
          )
          .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        sendMessage({ type: 'history_loaded', payload: { messages: displayMessages } });
        break;
      }
      case 'clear_history': {
        conversationHistory.length = 0;
        await extensionContext?.globalState.update(HISTORY_STATE_KEY, []);
        sendMessage({ type: 'history_cleared' });
        break;
      }
      case 'open_settings': {
        // Phase 4: VSCode 설정 패널 열기
        await vscode.commands.executeCommand('workbench.action.openSettings', 'vibeflow');
        break;
      }
      case 'get_workspace_config': {
        // WebView 마운트 후 요청 → workspace_config_init으로 응답 (pull 방식)
        sendMessage({
          type: 'workspace_config_init',
          payload: workspaceConfig,
        });
        break;
      }
      case 'save_workspace_config': {
        const { config: newConfig, target } = message.payload;
        const cfg = vscode.workspace.getConfiguration('vibeflow');
        // ConfigurationTarget: 1 = Global, 2 = Workspace
        const configTarget =
          target === 'global'
            ? vscode.ConfigurationTarget.Global
            : vscode.ConfigurationTarget.Workspace;

        await cfg.update('defaultProvider', newConfig.defaultProvider, configTarget);
        await cfg.update('systemPrompt', newConfig.systemPrompt, configTarget);
        await cfg.update('claudeMaxTokens', newConfig.claudeMaxTokens, configTarget);
        await cfg.update('openaiMaxTokens', newConfig.openaiMaxTokens, configTarget);
        await cfg.update('geminiMaxTokens', newConfig.geminiMaxTokens, configTarget);
        await cfg.update('ollamaMaxTokens', newConfig.ollamaMaxTokens, configTarget);
        await cfg.update('ollamaUrl', newConfig.ollamaUrl, configTarget);
        await cfg.update('ollamaModel', newConfig.ollamaModel, configTarget);
        // onDidChangeConfiguration이 자동 발화 → workspace_config_changed 자동 전송됨
        logger.info(`Settings saved to ${target}: ${JSON.stringify(newConfig)}`);
        break;
      }
    }
  } catch (error) {
    logger.error(error as Error);
    sendMessage({
      type: 'error',
      payload: { message: `Error: ${(error as Error).message}` },
    });
  }
}

async function handleChatSend(userMessage: string, _attachedFiles?: string[]): Promise<void> {
  try {
    // Initialize provider if needed
    if (!provider) {
      const providerConfig: ProviderConfig | undefined =
        activeProviderKey === 'ollama'
          ? {
              ollamaUrl: workspaceConfig.ollamaUrl,
              ollamaModel: workspaceConfig.ollamaModel,
            }
          : undefined;

      provider = createProvider(activeProviderKey, providerConfig);
      const secretKey = `${activeProviderKey}-api-key`;
      // Ollama는 API 키 불필요 — getSecret이 undefined를 반환하면 빈 문자열로 처리
      const apiKey = (await getSecret(secretKey)) ?? '';

      if (activeProviderKey !== 'ollama' && !apiKey) {
        sendMessage({
          type: 'error',
          payload: { message: `${activeProviderKey} API 키가 설정되지 않았습니다. "Vibe Flow: Set API Key" 명령을 실행하세요.` },
        });
        provider = null;
        return;
      }
      await provider.initialize(apiKey);
    }

    // Add user message to history
    conversationHistory.push({ role: 'user', content: userMessage });

    // Phase 3: 히스토리 저장
    await extensionContext?.globalState.update(HISTORY_STATE_KEY, conversationHistory);

    abortController = new AbortController();
    const signal = abortController.signal;

    // Tool use loop: keep calling Claude until no more tools are requested
    const MAX_TOOL_ITERATIONS = 10;
    let toolIteration = 0;
    let shouldContinue = true;
    while (shouldContinue) {
      if (signal.aborted) break;

      if (toolIteration >= MAX_TOOL_ITERATIONS) {
        sendMessage({
          type: 'stream_error',
          payload: {
            message: '⚠️ 도구 실행 횟수 한도(10회)에 도달했습니다. 요청을 더 구체적으로 작성해 주세요.',
            errorType: 'tool_loop',
            retryable: false,
          },
        });
        break;
      }
      toolIteration++;

      const pendingToolCalls: Array<{
        toolCallId: string;
        toolName: string;
        toolInput: Record<string, unknown>;
      }> = [];

      let assistantTextBuffer = '';

      // Context window management: trim old exchanges if token limit exceeded
      const trimResult = await ContextManager.trim(conversationHistory, provider);
      if (trimResult.trimmed) {
        conversationHistory.splice(0, conversationHistory.length, ...trimResult.messages);
        logger.info(`Context trimmed: removed ${trimResult.removedCount} messages`);
        sendMessage({
          type: 'stream_chunk',
          payload: { content: `\n_[컨텍스트 정리: ${trimResult.removedCount}개 오래된 메시지 제거됨]_\n` },
        });
      }

      // Get current provider's maxTokens from workspace config
      const providerMaxTokensKey = `${activeProviderKey}MaxTokens` as keyof typeof workspaceConfig;
      const maxTokens = (workspaceConfig[providerMaxTokensKey] as number) ?? 4096;

      // Stream one turn from the LLM
      for await (const chunk of provider.chat(conversationHistory, TOOLS, signal, { maxTokens })) {
        if (signal.aborted) break;

        switch (chunk.type) {
          case 'text': {
            assistantTextBuffer += chunk.content;
            sendMessage({ type: 'stream_chunk', payload: { content: chunk.content } });
            break;
          }
          case 'tool_use': {
            pendingToolCalls.push({
              toolCallId: chunk.toolCallId,
              toolName: chunk.toolName,
              toolInput: chunk.toolInput,
            });
            break;
          }
        }
      }

      if (signal.aborted) break;

      // Save assistant text turn to history
      if (assistantTextBuffer) {
        conversationHistory.push({ role: 'assistant', content: assistantTextBuffer });
        await extensionContext?.globalState.update(HISTORY_STATE_KEY, conversationHistory);
      }

      // No tools → conversation turn complete
      if (pendingToolCalls.length === 0) {
        shouldContinue = false;
        break;
      }

      // Save tool_use blocks as assistant messages
      for (const tc of pendingToolCalls) {
        conversationHistory.push({
          role: 'assistant',
          content: '',
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          toolInput: tc.toolInput,
        });
      }

      // Execute all tools and add results to history
      for (const toolCall of pendingToolCalls) {
        if (signal.aborted) break;
        const toolResultContent = await executeTool(toolCall, signal);
        conversationHistory.push({
          role: 'tool',
          content: toolResultContent,
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
        });
      }
    }

    sendMessage({ type: 'stream_end' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Aborted') {
        logger.info('Chat cancelled by user');
        sendMessage({ type: 'stream_end' });
      } else {
        const providerName = provider?.name?.toLowerCase() ?? 'unknown';
        const appError = parseProviderError(error, providerName);
        logger.error(`Chat error [${appError.type}]: ${appError.detail ?? appError.message}`);
        sendMessage({
          type: 'stream_error',
          payload: {
            message: appError.message,
            errorType: appError.type,
            retryable: appError.retryable,
          },
        });
      }
    } else {
      const providerName = provider?.name?.toLowerCase() ?? 'unknown';
      const appError = parseProviderError(error, providerName);
      logger.error(`Chat error [${appError.type}]: ${appError.detail ?? appError.message}`);
      sendMessage({
        type: 'stream_error',
        payload: {
          message: appError.message,
          errorType: appError.type,
          retryable: appError.retryable,
        },
      });
    }
  } finally {
    abortController = null;
  }
}

/**
 * 도구를 실행하고 결과 문자열을 반환한다.
 */
async function executeTool(
  toolCall: { toolCallId: string; toolName: string; toolInput: Record<string, unknown> },
  signal: AbortSignal
): Promise<string> {
  const { toolName, toolInput, toolCallId } = toolCall;

  if (toolName === 'read_file') {
    const filePath = toolInput.file_path as string;
    try {
      const content = await fileSystem.readFile(filePath);
      return JSON.stringify({ success: true, content });
    } catch (error) {
      return JSON.stringify({ success: false, error: (error as Error).message });
    }

  } else if (toolName === 'write_file') {
    const requestId = `write-${toolCallId}`;
    const filePath = toolInput.file_path as string;
    const content = toolInput.content as string;

    const result = await fileSystem.writeFile(
      filePath,
      content,
      requestId,
      (diff, isNewFile) => {
        sendMessage({
          type: 'request_write_file',
          payload: { requestId, filePath, diff, isNewFile },
        });
      }
    );

    sendMessage({
      type: 'tool_result',
      payload: {
        requestId,
        toolName: 'write_file',
        success: result.success,
        output: result.message,
      },
    });

    return JSON.stringify(result);

  } else if (toolName === 'run_terminal') {
    const requestId = `terminal-${toolCallId}`;
    const command = toolInput.command as string;

    const result = await terminal.runTerminal(
      command,
      requestId,
      (isDangerous, dangerReason) => {
        sendMessage({
          type: 'request_run_terminal',
          payload: { requestId, command, isDangerous, dangerReason },
        });
      },
      signal
    );

    sendMessage({
      type: 'tool_result',
      payload: {
        requestId,
        toolName: 'run_terminal',
        success: result.success,
        output: result.output,
      },
    });

    return JSON.stringify(result);

  } else if (toolName === 'list_directory') {
    const dirPath = toolInput.dir_path as string;
    try {
      const entries = await fileSystem.listDirectory(dirPath);
      return JSON.stringify({ success: true, entries });
    } catch (error) {
      return JSON.stringify({ success: false, error: (error as Error).message });
    }

  } else if (toolName === 'search_code') {
    const pattern = toolInput.pattern as string;
    const include = (toolInput.include as string | undefined) ?? '**/*';
    const maxResults = parseInt((toolInput.max_results as string | undefined) ?? '50', 10);
    try {
      const results = await fileSystem.searchCode(pattern, include, maxResults);
      return JSON.stringify({ success: true, results, count: results.length });
    } catch (error) {
      return JSON.stringify({ success: false, error: (error as Error).message });
    }

  } else {
    return JSON.stringify({ success: false, error: `Unknown tool: ${toolName}` });
  }
}

async function handleSelectProvider(providerKey: string): Promise<void> {
  const info = PROVIDER_LIST.find(p => p.key === providerKey);
  if (!info) {
    sendMessage({ type: 'error', payload: { message: `알 수 없는 프로바이더: ${providerKey}` } });
    return;
  }

  if (info.requiresApiKey) {
    const apiKey = await getSecret(`${providerKey}-api-key`);
    if (!apiKey) {
      sendMessage({ type: 'api_key_status', payload: { provider: providerKey, exists: false } });
      return;
    }
  }

  activeProviderKey = providerKey;
  provider = null; // lazy init: 다음 chat_send 때 초기화

  sendMessage({
    type: 'provider_changed',
    payload: { provider: providerKey, modelName: info.modelName },
  });

  logger.info(`Provider switched to: ${providerKey}`);
}

async function setApiKeyCommand(): Promise<void> {
  const apiKey = await vscode.window.showInputBox({
    prompt: 'Enter your Claude API key',
    password: true,
    ignoreFocusOut: true,
  });

  if (apiKey) {
    await setSecret('claude-api-key', apiKey);
    provider = null;
    vscode.window.showInformationMessage('Claude API key saved successfully');
  }
}

/** Extension → WebView 메시지 전송 (viewProvider를 통해) */
function sendMessage(message: ExtensionToWebviewMessage): void {
  viewProvider?.postMessage(message);
}

/**
 * 32자 랜덤 nonce 생성 (CSP 스크립트 허용용)
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * 빌드된 WebView HTML을 읽어서 리소스 경로를 WebView URI로 교체한다.
 * - 에셋 경로: /assets/, ./assets/, assets/ 모두 처리
 * - CSP nonce: ${nonce} 플레이스홀더를 실제 nonce로 교체
 * - script 태그에 nonce 속성 주입 (CSP 통과용)
 */
function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const htmlPath = path.join(context.extensionPath, 'dist', 'webview', 'index.html');

  if (!fs.existsSync(htmlPath)) {
    return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:2rem;color:#888;">
  <h2>⚡ Vibe Flow</h2>
  <p>WebView 빌드가 필요합니다: <code>npm run compile:web</code></p>
</body></html>`;
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');

  const nonce = getNonce();

  const distWebviewUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')
  );

  // 에셋 경로 교체: /assets/, ./assets/, assets/ 세 가지 패턴 모두 처리
  html = html.replace(/(src|href)="(\.\/)?\/?assets\//g, `$1="${distWebviewUri}/assets/`);

  // CSP nonce + webviewCspSrc 플레이스홀더 교체
  html = html.replace(/\$\{nonce\}/g, nonce);
  html = html.replace(/\$\{webviewCspSrc\}/g, webview.cspSource);

  // crossorigin 속성 제거 (VSCode WebView는 CORS 모드를 지원하지 않음)
  html = html.replace(/ crossorigin/g, '');

  // 모든 <script> 태그에 nonce 속성 주입 (CSP nonce-xxx 정책 통과)
  html = html.replace(/<script /g, `<script nonce="${nonce}" `);
  html = html.replace(/<script>/g, `<script nonce="${nonce}">`);

  return html;
}
