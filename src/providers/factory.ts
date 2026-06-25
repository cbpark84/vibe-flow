import { ILLMProvider } from './base';
import { ClaudeProvider } from './claude';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { OllamaProvider } from './ollama';

export type ProviderKey = 'claude' | 'openai' | 'gemini' | 'ollama';

/**
 * 프로바이더 이름으로 ILLMProvider 인스턴스를 생성한다.
 */
export function createProvider(providerName: string): ILLMProvider {
  const name = providerName.toLowerCase() as ProviderKey;

  switch (name) {
    case 'claude':
      return new ClaudeProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'ollama':
      return new OllamaProvider();
    default:
      throw new Error(`Unknown provider: ${providerName}`);
  }
}
