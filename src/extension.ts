import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ILLMProvider, ChatMessage, Tool } from './providers/base';
import { createProvider } from './providers/factory';
import { initializeSecretStorage, getSecret, setSecret } from './utils/secretStorage';
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
let panel: vscode.WebviewPanel | null = null;
let abortController: AbortController | null = null;

// Phase 3: ExtensionContext를 모듈 레벨에서 접근하기 위한 참조
let extensionContext: vscode.ExtensionContext | null = null;
const HISTORY_STATE_KEY = 'vibeflow.conversationHistory';

// Phase 2: 현재 활성 프로바이더 키 (기본값: 'claude')
let activeProviderKey = 'claude';

// Phase 4: 워크스페이스 설정
let workspaceConfig: WorkspaceConfig = getWorkspaceConfig();

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

  // Phase 4: 워크스페이스 설정 변경 리스너 등록
  const configChangeListener = onWorkspaceConfigChange((newConfig) => {
    workspaceConfig = newConfig;
    // WebView가 열려 있으면 설정 변경 알림
    if (panel) {
      sendMessage({
        type: 'workspace_config_changed',
        payload: newConfig,
      });
    }
  });
  context.subscriptions.push(configChangeListener);

  context.subscriptions.push(
    vscode.commands.registerCommand('vibeflow.openChat', async () => {
      await openChatPanel(context);
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

  await openChatPanel(context);
}

export async function deactivate(): Promise<void> {
  logger.info('Deactivating Vibe Flow extension');
  if (abortController) {
    abortController.abort();
  }
}

async function openChatPanel(context: vscode.ExtensionContext): Promise<void> {
  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    'vibeflow-chat',
    'Vibe Flow Chat',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      enableForms: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
      ],
    }
  );

  panel.webview.html = getWebviewContent(context, panel.webview);

  // Phase 4: 초기 워크스페이스 설정 전송
  panel.webview.postMessage({
    type: 'workspace_config_init',
    payload: workspaceConfig,
  });

  panel.webview.onDidReceiveMessage(
    async (message: WebviewToExtMessage) => {
      await handleWebviewMessage(message);
    },
    undefined,
    context.subscriptions
  );

  panel.onDidDispose(() => {
    panel = null;
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  });
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
    }
  } catch (error) {
    logger.error(error as Error);
    sendMessage({
      type: 'error',
      payload: { message: `Error: ${(error as Error).message}` },
    });
  }
}

async function handleChatSend(userMessage: string): Promise<void> {
  try {
    // Initialize provider if needed
    if (!provider) {
      provider = createProvider(activeProviderKey);
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
        // In-place update of conversationHistory
        conversationHistory.splice(0, conversationHistory.length, ...trimResult.messages);
        logger.info(`Context trimmed: removed ${trimResult.removedCount} messages`);
        // Notify WebView (optional)
        sendMessage({
          type: 'stream_chunk',
          payload: { content: `\n_[컨텍스트 정리: ${trimResult.removedCount}개 오래된 메시지 제거됨]_\n` },
        });
      }

      // Stream one turn from Claude
      for await (const chunk of provider.chat(conversationHistory, TOOLS, signal)) {
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
        // Phase 3: 히스토리 저장
        await extensionContext?.globalState.update(HISTORY_STATE_KEY, conversationHistory);
      }

      // No tools → conversation turn complete
      if (pendingToolCalls.length === 0) {
        shouldContinue = false;
        break;
      }

      // Save tool_use blocks as assistant messages (needed for Anthropic's message format)
      for (const tc of pendingToolCalls) {
        conversationHistory.push({
          role: 'assistant',
          content: '',          // text content empty — this is a tool_use block
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          toolInput: tc.toolInput,
        });
      }

      // Execute all tools, collect results, and add to history
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
    // 공식 Anthropic 패턴: APIUserAbortError는 정상적인 취소
    // WebView에 에러로 표시하지 않음 (사용자의 의도적인 취소이므로)
    if (error instanceof Error) {
      if (error.message === 'Aborted') {
        // 정상 취소 — 에러 메시지 없이 반환
        logger.info('Chat cancelled by user');
        sendMessage({ type: 'stream_end' });
      } else {
        // 실제 에러 발생
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
      // 비표준 에러 처리
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
    // Clean up abort controller after streaming completes
    abortController = null;
  }
}

/**
 * 도구를 실행하고 결과 문자열을 반환한다.
 * write_file과 run_terminal은 사용자 승인을 요구한다.
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
      // 키 없음 → WebView에 알려서 키 입력 UI 트리거
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
    // Reset provider so it reinitializes with the new key
    provider = null;
    vscode.window.showInformationMessage('Claude API key saved successfully');
  }
}

function sendMessage(message: ExtensionToWebviewMessage): void {
  panel?.webview.postMessage(message).catch((err: Error) => logger.error(err));
}

/**
 * 빌드된 WebView HTML을 읽어서 리소스 경로를 WebView URI로 교체한다.
 * - Vite 빌드 결과물: dist/webview/index.html + assets/
 * - 개발 중 빌드가 없을 경우 fallback HTML을 반환한다.
 */
function getWebviewContent(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const htmlPath = path.join(context.extensionPath, 'dist', 'webview', 'index.html');

  if (!fs.existsSync(htmlPath)) {
    // Fallback: 빌드 전 개발용 메시지
    return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:2rem;color:#888;">
  <h2>⚡ Vibe Flow</h2>
  <p>WebView 빌드가 필요합니다: <code>npm run compile:web</code></p>
</body></html>`;
  }

  let html = fs.readFileSync(htmlPath, 'utf-8');

  // Vite 출력의 asset 경로(./assets/)를 WebView URI로 교체
  const distWebviewUri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')
  );

  // Replace relative asset references with webview URIs
  html = html.replace(/\s(src|href)="(\.\/)?assets\//g, ` $1="${distWebviewUri}/assets/`);

  return html;
}

