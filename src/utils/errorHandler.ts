import Anthropic from '@anthropic-ai/sdk';

export interface AppError {
  type: 'auth' | 'rate_limit' | 'network' | 'server' | 'tool_loop' | 'unknown';
  message: string;
  detail?: string;
  retryable: boolean;
}

/**
 * Anthropic SDK 에러를 AppError로 변환
 *
 * 공식 Anthropic 에러 계층 구조:
 * - APIUserAbortError: 사용자 취소 (정상적인 완료)
 * - AuthenticationError: 401 (재시도 불가)
 * - RateLimitError: 429 (재시도 가능, retry-after 헤더 참고)
 * - APIConnectionTimeoutError: 타임아웃 (재시도 가능)
 * - APIConnectionError: 네트워크 연결 실패 (재시도 가능)
 * - InternalServerError: 500+ (재시도 가능)
 * - APIError: 기타 API 에러 (상태 코드 참고)
 *
 * @see https://github.com/anthropics/anthropic-sdk-python/blob/main/src/anthropic/_exceptions.py
 */
export function parseAnthropicError(err: unknown): AppError {
  // 정상적인 사용자 취소 — 에러로 표시하지 않음
  if (err instanceof Anthropic.APIUserAbortError) {
    return {
      type: 'unknown',
      message: '⏹️ 요청이 사용자에 의해 취소되었습니다.',
      retryable: false,
    };
  }

  if (err instanceof Anthropic.AuthenticationError) {
    return {
      type: 'auth',
      message: '❌ API 키가 유효하지 않습니다. 설정에서 API 키를 확인해 주세요.',
      detail: `[${err.request_id}] ${err.message}`,
      retryable: false,
    };
  }

  if (err instanceof Anthropic.RateLimitError) {
    // retry-after 헤더로 대기 시간 계산 (공식 권장)
    const retryAfter = err.headers?.get('retry-after');
    const waitSec = retryAfter ? parseInt(retryAfter, 10) : null;
    return {
      type: 'rate_limit',
      message: waitSec
        ? `⏱️ 요청 한도 초과. ${waitSec}초 후 다시 시도해 주세요.`
        : '⏱️ 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
      detail: `[${err.request_id}] ${err.message}`,
      retryable: true,
    };
  }

  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      type: 'network',
      message: '⌛ 요청 시간이 초과되었습니다. 네트워크 상태를 확인해 주세요.',
      detail: err.message,
      retryable: true,
    };
  }

  if (err instanceof Anthropic.APIConnectionError) {
    return {
      type: 'network',
      message: '🌐 네트워크 연결에 실패했습니다. 인터넷 연결을 확인해 주세요.',
      detail: err.message,
      retryable: true,
    };
  }

  if (err instanceof Anthropic.InternalServerError) {
    return {
      type: 'server',
      message: '🔧 Anthropic 서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      detail: `[${err.request_id}] ${err.message}`,
      retryable: true,
    };
  }

  if (err instanceof Anthropic.APIError) {
    return {
      type: 'unknown',
      message: `API 오류가 발생했습니다 (${err.status}).`,
      detail: `[${err.request_id}] ${err.message}`,
      retryable: false,
    };
  }

  if (err instanceof Error) {
    return {
      type: 'unknown',
      message: err.message,
      detail: err.stack,
      retryable: false,
    };
  }

  return {
    type: 'unknown',
    message: '알 수 없는 오류가 발생했습니다.',
    retryable: false,
  };
}

/**
 * 일반 에러를 사용자 친화적 메시지로 변환 (프로바이더 공통)
 */
export function parseProviderError(err: unknown, provider: string): AppError {
  // Anthropic 에러는 전용 파서로
  if (provider === 'claude') {
    return parseAnthropicError(err);
  }
  // 기타 프로바이더: HTTP 상태 코드 기반 처리
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('authentication')) {
      return {
        type: 'auth',
        message: `❌ ${provider} API 키가 유효하지 않습니다.`,
        detail: err.message,
        retryable: false,
      };
    }
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many')) {
      return {
        type: 'rate_limit',
        message: `⏱️ ${provider} 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.`,
        detail: err.message,
        retryable: true,
      };
    }
    if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('fetch failed')) {
      return {
        type: 'network',
        message: `🌐 ${provider}에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.`,
        detail: err.message,
        retryable: true,
      };
    }
    if (msg.includes('timeout')) {
      return {
        type: 'network',
        message: `⌛ ${provider} 요청 시간이 초과되었습니다.`,
        detail: err.message,
        retryable: true,
      };
    }
    return {
      type: 'unknown',
      message: err.message,
      detail: err.stack,
      retryable: false,
    };
  }
  return {
    type: 'unknown',
    message: '알 수 없는 오류가 발생했습니다.',
    retryable: false,
  };
}
