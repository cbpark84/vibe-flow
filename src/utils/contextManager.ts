import * as vscode from 'vscode';
import { ChatMessage, ILLMProvider } from '../providers/base';

export interface TokenUsage {
  used: number;
  limit: number;
  percentage: number;
}

interface ContextThresholds {
  /** 이 퍼센트 초과 시 트림 시작 */
  triggerPercent: number;
  /** 트림 후 목표 퍼센트 */
  targetPercent: number;
}

/**
 * Provider별 기본 임계값 (Option B: 모델 크기·특성 반영)
 * - Claude  200k: 70% trigger → 50% target (대용량, 상대적으로 여유)
 * - OpenAI  128k: 65% trigger → 45% target (중간)
 * - Gemini    1M: 75% trigger → 55% target (초대용량, 여유 있음)
 * - Ollama   32k: 50% trigger → 30% target (소용량, 조기 정리 필수)
 */
const DEFAULT_THRESHOLDS: Record<string, ContextThresholds> = {
  claude: { triggerPercent: 70, targetPercent: 50 },
  openai: { triggerPercent: 65, targetPercent: 45 },
  gemini: { triggerPercent: 75, targetPercent: 55 },
  ollama: { triggerPercent: 50, targetPercent: 30 },
};

/**
 * 메시지 히스토리의 토큰 관리.
 *
 * 핵심 규칙:
 * - 가장 오래된 exchange(user 메시지 + 그에 대한 모든 응답) 단위로 제거
 * - tool_use / tool_result 쌍은 반드시 함께 유지
 * - 최소 1개의 exchange(현재 대화)는 항상 보존
 * - Provider별 차등 임계값 적용 (사용자 설정으로 override 가능)
 */
export class ContextManager {
  /**
   * Provider별 컨텍스트 임계값을 반환한다.
   * VSCode 설정 > 기본값 순으로 적용.
   */
  private static getThresholds(provider: ILLMProvider): ContextThresholds {
    // provider.name 예: 'Claude', 'OpenAI', 'Gemini', 'Ollama' → lowercase
    const key = provider.name.toLowerCase();
    const defaults = DEFAULT_THRESHOLDS[key] ?? { triggerPercent: 65, targetPercent: 45 };

    // VSCode Settings에서 사용자 설정 읽기
    const config = vscode.workspace.getConfiguration('vibeflow.context');
    return {
      triggerPercent: config.get<number>(`${key}.triggerPercent`, defaults.triggerPercent),
      targetPercent: config.get<number>(`${key}.targetPercent`, defaults.targetPercent),
    };
  }

  /**
   * 메시지 목록의 총 토큰 수를 추정한다.
   */
  static async countTotal(messages: ChatMessage[], provider: ILLMProvider): Promise<number> {
    let total = 0;
    for (const msg of messages) {
      total += await provider.countTokens(msg.content);
    }
    return total;
  }

  /**
   * 현재 토큰 사용 현황을 반환한다.
   * limit는 triggerPercent 기준으로 표시.
   */
  static async getUsage(messages: ChatMessage[], provider: ILLMProvider): Promise<TokenUsage> {
    const { triggerPercent } = this.getThresholds(provider);
    const used = await this.countTotal(messages, provider);
    const limit = Math.floor(provider.maxTokens * (triggerPercent / 100));
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
   * 2. 총 토큰 수가 triggerPercent 초과 시 targetPercent까지 제거
   * 3. 최소 1개(현재 exchange)는 유지
   *
   * @returns 트림된 메시지 목록. 변경 없으면 원본 반환.
   */
  static async trim(
    messages: ChatMessage[],
    provider: ILLMProvider
  ): Promise<{ messages: ChatMessage[]; trimmed: boolean; removedCount: number }> {
    const { triggerPercent, targetPercent } = this.getThresholds(provider);
    const triggerTokens = Math.floor(provider.maxTokens * (triggerPercent / 100));
    const targetTokens = Math.floor(provider.maxTokens * (targetPercent / 100));

    let totalTokens = await this.countTotal(messages, provider);

    if (totalTokens <= triggerTokens) {
      return { messages, trimmed: false, removedCount: 0 };
    }

    // exchange 단위로 그룹핑
    const exchanges = this.groupIntoExchanges(messages);
    const originalCount = messages.length;

    // targetTokens 이하가 될 때까지 오래된 exchange부터 제거 (최소 1개 보존)
    while (exchanges.length > 1 && totalTokens > targetTokens) {
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
        !msg.toolCallId && // tool_result 아님
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
