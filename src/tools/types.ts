/**
 * 도구 정의 및 호출/결과 타입
 */

/** 도구 호출 요청 */
export interface ToolCallRequest {
  toolName: string;
  toolInput: Record<string, unknown>;
}

/** 도구 호출 결과 */
export interface ToolCallResult {
  toolName: string;
  success: boolean;
  output: string;
  isError?: boolean;
}
