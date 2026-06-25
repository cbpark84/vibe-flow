import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider, ChatMessage, Tool, StreamChunk } from './base';

export class ClaudeProvider implements ILLMProvider {
  private client: Anthropic | null = null;

  readonly name = 'Claude';
  readonly maxTokens = 200000;

  async initialize(apiKey: string): Promise<void> {
    // Configure Anthropic client with explicit timeout (공식 권장: 기본 600초는 너무 김)
    // maxRetries: SDK가 429, 500+, 네트워크 에러 자동 재시도 (기본값 2)
    this.client = new Anthropic({
      apiKey,
      timeout: 60 * 1000, // 60초 — VSCode 플러그인에서 사용자 경험 개선
      maxRetries: 2,      // 명시적 설정 (기본값과 동일하지만 명확성 위해)
    });
  }

  async *chat(
    messages: ChatMessage[],
    tools?: Tool[],
    signal?: AbortSignal
  ): AsyncIterableIterator<StreamChunk> {
    if (!this.client) {
      throw new Error('ClaudeProvider not initialized');
    }

    // Convert tools to Anthropic format
    const anthropicTools: Anthropic.Tool[] = (tools ?? []).map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool['input_schema'],
    }));

    // Convert ChatMessage[] to Anthropic MessageParam[]
    const anthropicMessages = buildAnthropicMessages(messages);

    // Create streaming request
    // Using Claude 3.5 Sonnet - most capable model available
    const stream = this.client.messages.stream({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      messages: anthropicMessages,
    });

    // Abort support
    if (signal?.aborted) {
      stream.abort();
      throw new Error('Aborted');
    }
    signal?.addEventListener('abort', () => stream.abort());

    // Per-block JSON buffer for tool input accumulation
    const toolBuffers = new Map<number, { id: string; name: string; json: string }>();

    try {
      for await (const event of stream) {
        if (signal?.aborted) {
          // 공식 패턴: abort는 APIUserAbortError 발동 (아래 catch에서 처리)
          throw new Error('Aborted');
        }

        if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'tool_use') {
            // Record tool identity; input arrives via input_json_delta
            toolBuffers.set(event.index, { id: block.id, name: block.name, json: '' });
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta;
          if (delta.type === 'text_delta' && delta.text) {
            yield { type: 'text', content: delta.text };
          } else if (delta.type === 'input_json_delta') {
            // Accumulate partial JSON for tool input
            const buf = toolBuffers.get(event.index);
            if (buf) {
              buf.json += delta.partial_json;
            }
          }
        } else if (event.type === 'content_block_stop') {
          const buf = toolBuffers.get(event.index);
          if (buf) {
            // Parse accumulated JSON and yield complete tool_use chunk
            let toolInput: Record<string, unknown> = {};
            try {
              if (buf.json) toolInput = JSON.parse(buf.json) as Record<string, unknown>;
            } catch {
              // Malformed JSON — yield with empty input
            }
            yield {
              type: 'tool_use',
              toolCallId: buf.id,
              toolName: buf.name,
              toolInput,
            };
            toolBuffers.delete(event.index);
          }
        }
      }
    } catch (error) {
      // 공식 패턴: APIUserAbortError는 정상적인 취소 (재전파 필요)
      if (error instanceof Anthropic.APIUserAbortError) {
        throw error;
      }
      // 일반적인 'Aborted' 메시지도 정상 취소로 처리 (사용자 UI에서 throw)
      if ((error as Error).message === 'Aborted') {
        throw error;
      }
      // Re-throw Anthropic errors with type info for proper handling in extension.ts
      if (error instanceof Anthropic.APIError) {
        throw error;
      }
      throw new Error(`Claude API streaming error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async countTokens(text: string): Promise<number> {
    // 1 token ≈ 4 characters (approximation)
    return Math.ceil(text.length / 4);
  }
}

/**
 * ChatMessage[] → Anthropic.MessageParam[]
 *
 * Role 매핑:
 * - 'user'      → user 텍스트 메시지
 * - 'assistant' + toolCallId → assistant 메시지의 tool_use 블록
 * - 'assistant' (no toolCallId) → assistant 텍스트 블록
 * - 'tool'      → user 메시지의 tool_result 블록
 *
 * Anthropic API 규칙:
 *   assistant 턴에서 tool_use 블록이 있으면
 *   바로 다음 user 턴에 해당 tool_result가 있어야 한다.
 */
function buildAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'user') {
      // Plain user message
      result.push({ role: 'user', content: msg.content });
      i++;
    } else if (msg.role === 'assistant') {
      // Collect consecutive assistant messages (text + tool_use blocks)
      const blocks: Anthropic.ContentBlock[] = [];

      while (i < messages.length && messages[i].role === 'assistant') {
        const m = messages[i];
        if (m.toolCallId && m.toolInput !== undefined) {
          blocks.push({
            type: 'tool_use',
            id: m.toolCallId,
            name: m.toolName ?? '',
            input: m.toolInput,
          } as Anthropic.ToolUseBlock);
        } else {
          blocks.push({ type: 'text', text: m.content });
        }
        i++;
      }

      // If only one text block, use string shorthand
      if (blocks.length === 1 && blocks[0].type === 'text') {
        result.push({ role: 'assistant', content: (blocks[0] as Anthropic.TextBlock).text });
      } else {
        result.push({ role: 'assistant', content: blocks });
      }
    } else if (msg.role === 'tool') {
      // Tool result — must be a user message with tool_result block
      result.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.toolCallId ?? '',
            content: msg.content,
          } as Anthropic.ToolResultBlockParam,
        ],
      });
      i++;
    } else {
      i++;
    }
  }

  return result;
}
