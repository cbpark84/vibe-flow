import { ChatMessage, ILLMProvider } from '../providers/base';

export interface TokenUsage {
  used: number;
  limit: number;
  percentage: number;
}

/**
 * 메시지 히스토리의 토큰 관리.
 *
 * 핵심 규칙:
 * - 가장 오래된 exchange(user 메시지 + 그에 대한 모든 응답) 단위로 제거
 * - tool_use / tool_result 쌍은 반드시 함께 유지
 * - 최소 1개의 exchange(현재 대화)는 항상 보존
 * - Claude(200k), OpenAI(128k), Gemini(1M), Ollama(32k) 모두 동일 로직 적용
 */
export class ContextManager {
  /**
   * 메시지 목록의 총 토큰 수를 추정한다.
   */
  static async countTotal(
    messages: ChatMessage[],
    provider: ILLMProvider
  ): Promise<number> {
    let total = 0;
    for (const msg of messages) {
      total += await provider.countTokens(msg.content);
    }
    return total;
  }

  /**
   * 현재 토큰 사용 현황을 반환한다.
   */
  static async getUsage(
    messages: ChatMessage[],
    provider: ILLMProvider
  ): Promise<TokenUsage> {
    const used = await this.countTotal(messages, provider);
    const limit = Math.floor(provider.maxTokens * 0.8);
    return {
      used,
      limit,
      percentage: Math.min(100, Math.round((used / limit) * 100)),
    };
  }

  /**
   * 메시지 목록을 토큰 제한에 맞게 트림한다.
   *
   * 알고리즘:
   * 1. 메시지를 exchange 단위로 그룹핑 (user 메시지로 시작하는 블록)
   * 2. 총 토큰 수가 제한 초과 시 가장 오래된 exchange부터 제거
   * 3. 최소 1개(현재 exchange)는 유지
   *
   * @returns 트림된 메시지 목록. 변경 없으면 원본 반환.
   */
  static async trim(
    messages: ChatMessage[],
    provider: ILLMProvider
  ): Promise<{ messages: ChatMessage[]; trimmed: boolean; removedCount: number }> {
    const maxTokens = Math.floor(provider.maxTokens * 0.8);
    let totalTokens = await this.countTotal(messages, provider);

    if (totalTokens <= maxTokens) {
      return { messages, trimmed: false, removedCount: 0 };
    }

    // exchange 단위로 그룹핑
    const exchanges = this.groupIntoExchanges(messages);
    const originalCount = messages.length;

    // 오래된 exchange부터 제거 (최소 1개 exchange 보존)
    while (exchanges.length > 1 && totalTokens > maxTokens) {
      const oldest = exchanges.shift()!;
      for (const msg of oldest) {
        totalTokens -= await provider.countTokens(msg.content);
      }
    }

    const trimmed = exchanges.flat();
    return {
      messages: trimmed,
      trimmed: true,
      removedCount: originalCount - trimmed.length,
    };
  }

  /**
   * 메시지 목록을 exchange 단위로 그룹핑한다.
   *
   * exchange = user 메시지 하나 + 이후 assistant/tool 메시지 전체
   * (다음 user 메시지 직전까지)
   *
   * tool_use 블록인 assistant 메시지(toolCallId 있음)는 독립 exchange를 시작하지 않음.
   */
  private static groupIntoExchanges(messages: ChatMessage[]): ChatMessage[][] {
    const exchanges: ChatMessage[][] = [];
    let current: ChatMessage[] = [];

    for (const msg of messages) {
      const isNewUserTurn =
        msg.role === 'user' &&
        !msg.toolCallId &&   // tool_result 아님
        current.length > 0;

      if (isNewUserTurn) {
        exchanges.push(current);
        current = [msg];
      } else {
        current.push(msg);
      }
    }

    if (current.length > 0) {
      exchanges.push(current);
    }

    return exchanges;
  }
}
