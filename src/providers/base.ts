/**
 * LLM 메시지의 역할 구분.
 * 'tool' 역할은 도구 실행 결과를 LLM에 돌려줄 때 사용.
 */
export type MessageRole = 'user' | 'assistant' | 'tool';

/**
 * LLM에 전달하는 단일 메시지 구조.
 */
export interface ChatMessage {
  role: MessageRole;
  /**
   * role이 'tool'인 경우 toolCallId와 toolName이 필수.
   * content는 도구 실행 결과 JSON 문자열.
   */
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>; // tool_use 블록의 input (assistant 역할에서 사용)
}

/**
 * LLM에 전달할 도구 정의 (JSON Schema 기반).
 * Anthropic / OpenAI 양쪽에서 사용 가능한 최소 공통 구조.
 */
export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * 스트리밍 청크의 세 가지 종류.
 *
 * - TextChunk:       LLM이 생성한 텍스트 조각
 * - ToolUseChunk:    LLM이 도구 호출을 요청 (id, name, input 포함)
 * - ToolResultChunk: 도구 실행 결과를 LLM에게 피드백 (내부 처리용)
 */
export type StreamChunk =
  | { type: 'text';        content: string }
  | { type: 'tool_use';   toolCallId: string; toolName: string; toolInput: Record<string, unknown> }
  | { type: 'tool_result'; toolCallId: string; content: string; isError: boolean };

/**
 * 모든 LLM 프로바이더가 구현해야 하는 공통 인터페이스.
 *
 * 규칙:
 * - initialize() 호출 전 chat() / countTokens() 호출 시 Error throw.
 * - chat()은 AbortSignal을 통해 외부에서 스트리밍을 취소할 수 있어야 함.
 * - chat()에서 발생한 네트워크/API 에러는 그대로 throw (호출자가 처리).
 */
export interface ILLMProvider {
  /** 화면에 표시될 프로바이더 이름. 예: 'Claude', 'GPT-4' */
  readonly name: string;

  /** 이 프로바이더의 컨텍스트 윈도우 최대 토큰 수. */
  readonly maxTokens: number;

  /**
   * API 클라이언트를 초기화한다.
   * @param apiKey - SecretStorage에서 꺼낸 API 키
   */
  initialize(apiKey: string): Promise<void>;

  /**
   * 스트리밍 채팅을 시작한다.
   * @param messages - 전체 대화 히스토리
   * @param tools    - LLM에 노출할 도구 목록 (없으면 빈 배열)
   * @param signal   - 스트리밍 취소용 AbortSignal
   * @yields StreamChunk — text / tool_use / tool_result 순서로 발행
   */
  chat(
    messages: ChatMessage[],
    tools?: Tool[],
    signal?: AbortSignal,
  ): AsyncIterableIterator<StreamChunk>;

  /**
   * 주어진 텍스트의 토큰 수를 추정한다.
   * 정확한 카운팅 API가 없는 경우 1 token ≈ 4 chars 근사값 사용.
   */
  countTokens(text: string): Promise<number>;
}
