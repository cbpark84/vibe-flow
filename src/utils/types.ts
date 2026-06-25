// ─────────────────────────────────────────────────────────────
// WebView → Extension 메시지 (WebView가 발송, Extension이 수신)
// ─────────────────────────────────────────────────────────────

/** 사용자가 채팅 메시지를 전송할 때 */
export interface WVMsg_SendChat {
  type: 'chat_send';
  payload: {
    message: string;
    /** 채팅에 첨부할 파일 경로 목록 (없으면 빈 배열) */
    attachedFiles: string[];
  };
}

/** 스트리밍 중 사용자가 취소 버튼을 누를 때 */
export interface WVMsg_AbortStream {
  type: 'chat_abort';
}

/** 사용자가 write_file 승인 요청에 응답할 때 */
export interface WVMsg_ApproveWriteFile {
  type: 'approve_write_file';
  payload: {
    /** Extension이 발행했던 요청과 매칭하는 ID */
    requestId: string;
    approved: boolean;
  };
}

/** 사용자가 run_terminal 승인 요청에 응답할 때 */
export interface WVMsg_ApproveRunTerminal {
  type: 'approve_run_terminal';
  payload: {
    requestId: string;
    approved: boolean;
  };
}

/** API 키를 SecretStorage에 저장할 때 */
export interface WVMsg_SaveApiKey {
  type: 'save_api_key';
  payload: {
    provider: string;   // 예: 'claude'
    apiKey: string;
  };
}

/** API 키 존재 여부 확인 요청 */
export interface WVMsg_CheckApiKey {
  type: 'check_api_key';
  payload: {
    provider: string;
  };
}



// ─────────────────────────────────────────────────────────────
// Extension → WebView 메시지 (Extension이 발송, WebView가 수신)
// ─────────────────────────────────────────────────────────────

/** LLM이 생성한 텍스트 청크 (스트리밍 중) */
export interface ExtMsg_StreamChunk {
  type: 'stream_chunk';
  payload: {
    content: string;
  };
}

/** 스트리밍이 정상 완료됨 */
export interface ExtMsg_StreamEnd {
  type: 'stream_end';
}

/** 스트리밍 중 에러 발생 (API 오류, 네트워크 등) */
export interface ExtMsg_StreamError {
  type: 'stream_error';
  payload: {
    message: string;
  };
}

/** write_file 승인 요청: diff 포함 */
export interface ExtMsg_RequestWriteFile {
  type: 'request_write_file';
  payload: {
    requestId: string;
    filePath: string;
    /** unified diff 형식 문자열 */
    diff: string;
    /** 파일이 신규 생성인지 여부 */
    isNewFile: boolean;
  };
}

/** run_terminal 승인 요청: 명령어 포함 */
export interface ExtMsg_RequestRunTerminal {
  type: 'request_run_terminal';
  payload: {
    requestId: string;
    command: string;
    /** 위험 명령어 탐지 여부 */
    isDangerous: boolean;
    /** 감지된 위험 패턴 설명 (isDangerous=true 시 필수) */
    dangerReason?: string;
  };
}

/** write_file 또는 run_terminal 도구 실행 완료 결과 */
export interface ExtMsg_ToolResult {
  type: 'tool_result';
  payload: {
    requestId: string;
    toolName: 'write_file' | 'run_terminal';
    success: boolean;
    /** 터미널 실행 stdout+stderr 또는 에러 메시지 */
    output?: string;
  };
}

/** API 키 확인 결과 응답 */
export interface ExtMsg_ApiKeyStatus {
  type: 'api_key_status';
  payload: {
    provider: string;
    exists: boolean;
  };
}

/** 일반 에러 알림 (스트리밍과 무관한 에러) */
export interface ExtMsg_Error {
  type: 'error';
  payload: {
    message: string;
    code?: string;
  };
}

/** 모든 Extension → WebView 메시지의 유니온 타입 */
export type ExtensionToWebviewMessage =
  | ExtMsg_StreamChunk
  | ExtMsg_StreamEnd
  | ExtMsg_StreamError
  | ExtMsg_RequestWriteFile
  | ExtMsg_RequestRunTerminal
  | ExtMsg_ToolResult
  | ExtMsg_ApiKeyStatus
  | ExtMsg_Error
  | ExtMsg_ProviderChanged
  | ExtMsg_ProviderList;

// ─────────────────────────────────────────────────────────────
// Phase 2: 프로바이더 관련 메시지
// ─────────────────────────────────────────────────────────────

/** 프로바이더 목록 항목 */
export interface ProviderInfo {
  key: string;
  displayName: string;
  modelName: string;
  requiresApiKey: boolean;
}

/** WebView → Extension: 사용자가 프로바이더를 선택했을 때 */
export interface WVMsg_SelectProvider {
  type: 'select_provider';
  payload: { provider: string };
}

/** WebView → Extension: 초기화 시 프로바이더 목록 요청 */
export interface WVMsg_GetProviderList {
  type: 'get_provider_list';
}

/** Extension → WebView: 프로바이더 전환 완료 */
export interface ExtMsg_ProviderChanged {
  type: 'provider_changed';
  payload: { provider: string; modelName: string };
}

/** Extension → WebView: 프로바이더 전체 목록 */
export interface ExtMsg_ProviderList {
  type: 'provider_list';
  payload: { providers: ProviderInfo[]; activeProvider: string };
}

// ─────────────────────────────────────────────────────────────
// Phase 3: 채팅 히스토리 관련 메시지
// ─────────────────────────────────────────────────────────────

/** WebView → Extension: 저장된 히스토리 요청 */
export interface WVMsg_GetHistory {
  type: 'get_history';
}

/** WebView → Extension: 히스토리 전체 삭제 요청 */
export interface WVMsg_ClearHistory {
  type: 'clear_history';
}

/** Extension → WebView: 저장된 히스토리 전달 (패널 열릴 때) */
export interface ExtMsg_HistoryLoaded {
  type: 'history_loaded';
  payload: {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
}

/** Extension → WebView: 히스토리 삭제 완료 */
export interface ExtMsg_HistoryCleared {
  type: 'history_cleared';
}

/** 업데이트된 WebView → Extension 유니온 (Phase 3) */
export type WebviewToExtMessage =
  | WVMsg_SendChat
  | WVMsg_AbortStream
  | WVMsg_ApproveWriteFile
  | WVMsg_ApproveRunTerminal
  | WVMsg_SaveApiKey
  | WVMsg_CheckApiKey
  | WVMsg_SelectProvider
  | WVMsg_GetProviderList
  | WVMsg_GetHistory
  | WVMsg_ClearHistory;

/** 업데이트된 Extension → WebView 유니온 (Phase 3) */
export type ExtensionToWebviewMessage =
  | ExtMsg_StreamChunk
  | ExtMsg_StreamEnd
  | ExtMsg_StreamError
  | ExtMsg_RequestWriteFile
  | ExtMsg_RequestRunTerminal
  | ExtMsg_ToolResult
  | ExtMsg_ApiKeyStatus
  | ExtMsg_Error
  | ExtMsg_ProviderChanged
  | ExtMsg_ProviderList
  | ExtMsg_HistoryLoaded
  | ExtMsg_HistoryCleared;
