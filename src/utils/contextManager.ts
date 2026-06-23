import { ChatMessage } from '../providers/base';
import { ILLMProvider } from '../providers/base';

/**
 * 메시지 히스토리의 토큰 합산 및 오래된 메시지 trim
 */
export class ContextManager {
  /**
   * 메시지 목록을 토큰 제한에 맞게 자른다.
   * @param messages - 전체 메시지 목록
   * @param provider - 토큰 카운팅을 위한 프로바이더
   * @returns 자른 메시지 목록
   */
  static async trim(
    messages: ChatMessage[],
    provider: ILLMProvider
  ): Promise<ChatMessage[]> {
    const maxTokens = Math.floor(provider.maxTokens * 0.8);
    let totalTokens = 0;

    // 모든 메시지의 토큰 수 계산
    for (const msg of messages) {
      const tokens = await provider.countTokens(msg.content);
      totalTokens += tokens;
    }

    // 이미 제한 이내면 그대로 반환
    if (totalTokens <= maxTokens) {
      return messages;
    }

    // 오래된 메시지부터 제거 (system 메시지는 제외)
    const result = [...messages];
    let removedTokens = 0;

    for (let i = 1; i < result.length && removedTokens < totalTokens - maxTokens; i++) {
      const msg = result[i];
      const tokens = await provider.countTokens(msg.content);
      removedTokens += tokens;
      result.splice(i, 1);
      i--;
    }

    return result;
  }
}
