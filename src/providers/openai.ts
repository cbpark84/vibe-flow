import OpenAI from 'openai';
import { ILLMProvider, ChatMessage, Tool, StreamChunk } from './base';

/**
 * OpenAI 프로바이더 (gpt-4o 기본).
 * tool_calls는 스트리밍 조각으로 전달되므로 index별로 누적 후 완성 시 yield.
 */
export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI | null = null;

  readonly name = 'OpenAI';
  readonly maxTokens = 128_000;

  async initialize(apiKey: string): Promise<void> {
    this.client = new OpenAI({ apiKey });
  }

  async *chat(
    messages: ChatMessage[],
    tools: Tool[] = [],
    signal?: AbortSignal
  ): AsyncIterableIterator<StreamChunk> {
    if (!this.client) throw new Error('OpenAIProvider not initialized');

    // ChatMessage[] → OpenAI 형식 변환
    const oaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: msg.toolCallId ?? '',
          content: msg.content,
        };
      }
      if (msg.role === 'assistant' && msg.toolCallId) {
        // tool_use 블록 — assistant 메시지의 tool_calls 항목
        return {
          role: 'assistant' as const,
          content: msg.content || null,
          tool_calls: [
            {
              id: msg.toolCallId,
              type: 'function' as const,
              function: {
                name: msg.toolName ?? '',
                arguments: JSON.stringify(msg.toolInput ?? {}),
              },
            },
          ],
        };
      }
      return {
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      };
    });

    // Tool[] → OpenAI ChatCompletionTool[] 변환
    const oaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    const stream = await this.client.chat.completions.create(
      {
        model: 'gpt-4o',
        messages: oaiMessages,
        tools: oaiTools.length > 0 ? oaiTools : undefined,
        stream: true,
      },
      { signal }
    );

    // tool_calls 조각 누적용 Map
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      if (signal?.aborted) throw new Error('Aborted');

      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      // 텍스트 청크
      if (delta.content) {
        yield { type: 'text', content: delta.content };
      }

      // tool_calls 조각 누적
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!toolCallBuffers.has(idx)) {
            toolCallBuffers.set(idx, { id: tc.id ?? '', name: tc.function?.name ?? '', args: '' });
          }
          const buf = toolCallBuffers.get(idx)!;
          if (tc.id) buf.id = tc.id;
          if (tc.function?.name) buf.name = tc.function.name;
          if (tc.function?.arguments) buf.args += tc.function.arguments;
        }
      }

      // 스트림 종료 시 tool_calls yield
      if (choice.finish_reason === 'tool_calls') {
        for (const [, buf] of toolCallBuffers) {
          let toolInput: Record<string, unknown> = {};
          try {
            toolInput = JSON.parse(buf.args) as Record<string, unknown>;
          } catch {
            /* 빈 input */
          }

          yield {
            type: 'tool_use',
            toolCallId: buf.id,
            toolName: buf.name,
            toolInput,
          };
        }
        toolCallBuffers.clear();
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}
