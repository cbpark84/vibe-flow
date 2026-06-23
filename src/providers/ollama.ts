import { ILLMProvider, ChatMessage, Tool, StreamChunk } from './base';

const OLLAMA_BASE_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'llama3.2';

interface OllamaMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
}

interface OllamaStreamChunk {
  message?: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  done: boolean;
}

/**
 * Ollama 로컬 LLM 프로바이더.
 * fetch 기반 NDJSON 스트리밍. API 키 불필요.
 */
export class OllamaProvider implements ILLMProvider {
  readonly name = 'Ollama';
  readonly maxTokens = 32_000;

  // API 키 불필요 — no-op
  async initialize(): Promise<void> {}

  async *chat(
    messages: ChatMessage[],
    tools: Tool[] = [],
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk> {
    // ChatMessage[] → Ollama 형식 변환
    const ollamaMessages: OllamaMessage[] = messages
      .filter(msg => msg.role !== 'tool' || !msg.toolCallId) // tool_use 블록 제외
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));

    // Tool[] → Ollama tools 형식
    const ollamaTools = tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    let response: Response;
    try {
      response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages: ollamaMessages,
          tools: ollamaTools.length > 0 ? ollamaTools : undefined,
          stream: true,
        }),
        signal,
      });
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
        throw new Error('Ollama가 실행 중이지 않습니다. 터미널에서 `ollama serve` 명령으로 시작하세요.');
      }
      throw error;
    }

    if (!response.ok) {
      throw new Error(`Ollama 오류: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Ollama 응답 스트림이 없습니다.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) throw new Error('Aborted');

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed: OllamaStreamChunk;
          try {
            parsed = JSON.parse(trimmed) as OllamaStreamChunk;
          } catch {
            continue;
          }

          const msg = parsed.message;
          if (!msg) continue;

          if (msg.content) {
            yield { type: 'text', content: msg.content };
          }

          if (msg.tool_calls) {
            for (const tc of msg.tool_calls) {
              yield {
                type: 'tool_use',
                toolCallId: `ollama-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                toolName: tc.function.name,
                toolInput: tc.function.arguments,
              };
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}
