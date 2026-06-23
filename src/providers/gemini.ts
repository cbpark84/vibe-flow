import {
  GoogleGenerativeAI,
  Content,
  Part,
  FunctionDeclaration,
  SchemaType,
} from '@google/generative-ai';
import { ILLMProvider, ChatMessage, Tool, StreamChunk } from './base';

/**
 * Google Gemini 프로바이더 (gemini-1.5-pro 기본).
 * Gemini role: 'user' | 'model' 만 허용.
 * tool 결과는 role='user', functionResponse parts로 변환.
 */
export class GeminiProvider implements ILLMProvider {
  private client: GoogleGenerativeAI | null = null;

  readonly name = 'Gemini';
  readonly maxTokens = 1_000_000;

  async initialize(apiKey: string): Promise<void> {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async *chat(
    messages: ChatMessage[],
    tools: Tool[] = [],
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk> {
    if (!this.client) throw new Error('GeminiProvider not initialized');

    // ChatMessage[] → Gemini Content[] 변환
    const contents: Content[] = [];
    for (const msg of messages) {
      if (msg.role === 'tool') {
        // tool 결과: user role + functionResponse part
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: msg.toolName ?? '',
              response: { result: msg.content },
            },
          }] as Part[],
        });
      } else if (msg.role === 'assistant' && msg.toolCallId) {
        // tool_use 블록: model role + functionCall part
        contents.push({
          role: 'model',
          parts: [{
            functionCall: {
              name: msg.toolName ?? '',
              args: msg.toolInput ?? {},
            },
          }] as Part[],
        });
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Tool[] → Gemini FunctionDeclaration[] 변환
    const geminiTools = tools.length > 0 ? [{
      functionDeclarations: tools.map((tool): FunctionDeclaration => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties: Object.fromEntries(
            Object.entries(tool.inputSchema.properties).map(([k, v]) => [
              k,
              { type: v.type as SchemaType, description: v.description },
            ])
          ),
          required: tool.inputSchema.required,
        },
      })),
    }] : undefined;

    const model = this.client.getGenerativeModel({
      model: 'gemini-1.5-pro',
      tools: geminiTools,
    });

    const result = await model.generateContentStream({ contents });

    for await (const chunk of result.stream) {
      if (signal?.aborted) throw new Error('Aborted');

      // 텍스트
      const text = chunk.text();
      if (text) {
        yield { type: 'text', content: text };
      }

      // Function calls
      const candidate = chunk.candidates?.[0];
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.functionCall) {
            yield {
              type: 'tool_use',
              toolCallId: `gemini-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              toolName: part.functionCall.name,
              toolInput: (part.functionCall.args ?? {}) as Record<string, unknown>,
            };
          }
        }
      }
    }
  }

  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}
