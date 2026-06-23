# Claude를 위한 작업 가이드

See AGENTS.md for shared project instructions and conventions.

---

## 1. Claude의 역할

이 프로젝트에서 Claude는 다음 두 가지 역할을 동시에 수행한다:

### 역할 1: 플러그인 개발자
- VSCode Extension Host (TypeScript) 구현
- WebView UI (React) 개발
- 플러그인 아키텍처 설계 및 구현

### 역할 2: 플러그인이 연동할 대상
- 이 플러그인의 `src/providers/claude.ts`는 Anthropic SDK를 호출하여 Claude API와 통신
- Claude가 개발한 플러그인이 Claude를 호출하는 순환 구조
- 따라서 Claude는 최신 Anthropic SDK 사용법을 항상 최신으로 유지해야 함

**주의**: Claude를 위한 프로바이더 구현 시, 다른 프로바이더(OpenAI, Gemini)와의 인터페이스 일관성을 깨뜨리지 말 것.

---

## 2. Claude 전용 작업 원칙

### 2.1 새 라이브러리/프레임워크 사용 시 문서 확인 필수
**절대 규칙**: 직접 구현하기 전에 `/context7` 스킬로 최신 문서를 한 번 읽을 것.

```
이 프로젝트에서 사용하는 라이브러리들:
- @anthropic-ai/sdk (Anthropic API)
- openai (OpenAI API)
- @google/generative-ai (Gemini API)
- vscode (VSCode Extension API)
- react (WebView UI)
- vite (빌드 도구)
```

**예시**:
```
새로 Streaming 구현? → /context7로 최신 Anthropic SDK 스트리밍 방식 확인
React Hook 사용? → /context7로 React 18 문서 확인
VSCode WebView 통신? → /context7로 VSCode Extension API 문서 확인
```

### 2.2 파일 작업 순서
**필수 순서**:
1. Read: 해당 파일을 먼저 읽기 (기존 코드 스타일 파악)
2. Edit/Write: 변경사항 적용
3. 재검사 금지: Edit/Write 후 다시 Read하지 말 것 (파일 상태 추적됨)

```
❌ 잘못된 순서
1. 파일을 Read 없이 Write
2. 파일을 다시 Read하여 "확인"

✅ 올바른 순서
1. Read로 파일 내용 확인
2. Edit/Write로 변경
3. 다음 작업으로 이동 (재검사 불필요)
```

### 2.3 코드 변경 시 변경 이유 코멘트
**모든 수정에는 간단한 설명 포함**:

```typescript
// ✅ 좋은 예
// AGENTS.md rule: postMessage only for WebView communication
const vscode = window.acquireVsCodeApi();
vscode.postMessage({ type: 'read_file', payload: { filePath } });

// ❌피할 예
// 변경됨
const vscode = window.acquireVsCodeApi();
```

### 2.4 불확실한 요구사항은 구현 전 PM에게 확인
**스코프 불명확?** → 구현하지 말고 질문하기

```
예시:
- "이 기능은 Phase 1인가 Phase 2인가?" → PM에게 물어보기
- "프로바이더 이름은 뭐로 할까?" → PM(PLAN.md의 TBD)에게 물어보기
- "API 키 만료 시간은?" → 명세가 없으면 물어보기
```

---

## 3. Claude 전용 구현 가이드

### 3.1 Anthropic SDK 사용 (claude.ts)

**최신 정보 확인 필수**: `/context7`로 최신 SDK 문서 읽기

**기본 구조**:
```typescript
// src/providers/claude.ts

import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider, ChatMessage, Tool } from './base';

export class ClaudeProvider implements ILLMProvider {
  private client: Anthropic;
  
  readonly name = 'Claude';
  readonly maxTokens = 200000;
  
  async initialize(apiKey: string): Promise<void> {
    this.client = new Anthropic({ apiKey });
  }
  
  async *chat(
    messages: ChatMessage[],
    tools?: Tool[]
  ): AsyncIterableIterator<string> {
    // 1. messages를 Anthropic 형식으로 변환
    // 2. tools 설정
    // 3. streaming 시작
    // 4. 각 청크마다 yield
  }
  
  async countTokens(text: string): Promise<number> {
    // Anthropic token counter 사용
    // 또는 예측값 (약 1 token = 4 characters)
  }
}
```

**스트리밍 구현 주의**:
- VSCode WebView는 SSE를 받을 수 없음
- Extension Host에서 스트림을 받아 postMessage로 WebView에 전달
- 흐름: Anthropic API Stream → Extension → postMessage → WebView UI

### 3.2 Extension Host에서 프로바이더 인스턴스화

```typescript
// src/extension.ts

import { ClaudeProvider } from './providers/claude';
import { getSecret } from './utils/secretStorage';

// 사용자가 Claude를 선택했을 때
const provider = new ClaudeProvider();
const apiKey = await getSecret('claude-api-key');
await provider.initialize(apiKey);

// 이후 chat() 호출
for await (const chunk of provider.chat(messages)) {
  // chunk를 WebView에 postMessage로 전송
}
```

### 3.3 Tool Use 구현 (Function Calling)

Claude의 Tool Use를 플러그인의 도구와 매핑:

```typescript
// 예: Claude가 파일을 읽도록 요청

const tools: Tool[] = [
  {
    name: 'read_file',
    description: '파일 내용을 읽습니다',
    input_schema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: '파일 경로' }
      },
      required: ['file_path']
    }
  }
];

// Claude의 응답에서 tool_use 블록 처리
const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022', // 최신 모델 확인!
  max_tokens: 1024,
  tools: tools,
  messages: messages
});

// tool_use 블록을 감지하여 도구 실행 후 다시 API 호출
```

### 3.4 토큰 카운팅

```typescript
// Anthropic의 토큰 카운팅
async countTokens(text: string): Promise<number> {
  // 방법 1: Anthropic Token Counter 라이브러리 (존재하면)
  // 방법 2: 근사값 사용 (1 token ≈ 4 characters)
  return Math.ceil(text.length / 4);
}
```

---

## 4. VSCode Extension API 주의점

### 4.1 WebView와의 통신
```typescript
// ✅ 올바른 패턴
panel.webview.onDidReceiveMessage(async (message) => {
  if (message.type === 'chat_message') {
    // Extension Host에서만 처리 (파일 접근, API 호출 등)
    const response = await processMessage(message.payload);
    panel.webview.postMessage({ type: 'response', payload: response });
  }
});

// ❌ 잘못된 패턴
// WebView에서 직접 파일/API 접근 시도
const fs = require('fs');
fs.readFileSync(path); // VSCode 샌드박스로 불가능
```

### 4.2 Secrets Storage
```typescript
// src/utils/secretStorage.ts 사용
import { getSecret, setSecret } from './utils/secretStorage';

// API 키 저장
await setSecret('claude-api-key', userInput);

// API 키 조회
const apiKey = await getSecret('claude-api-key');
if (!apiKey) {
  vscode.window.showErrorMessage('Claude API 키를 등록하세요');
}
```

### 4.3 OutputChannel 로깅
```typescript
// ❌ 금지
console.log('Chat started');

// ✅ 권장
import { getLogger } from './utils/logger';
const logger = getLogger('ChatProvider');
logger.info('Chat started');
```

---

## 5. 작업 체크리스트

### 코드 작성 전
- [ ] PLAN.md에서 현재 Phase 확인
- [ ] 관련 인터페이스/타입 확인 (base.ts, types.ts)
- [ ] 필요한 라이브러리 문서 /context7로 확인

### 코드 작성 후
- [ ] TypeScript 컴파일 오류 없음 (`npm run compile`)
- [ ] ESLint 경고 없음 (`npm run lint`)
- [ ] 파일명/함수명 컨벤션 확인 (camelCase, I 접두사 등)
- [ ] 공개 함수에 JSDoc 주석 있음
- [ ] 보안: API 키 하드코딩 없음, SecretStorage 사용
- [ ] 아키텍처: ILLMProvider 구현, postMessage 패턴 준수

### 완료 보고
- [ ] 변경된 파일 목록 (절대 경로)
- [ ] 실행 방법 또는 테스트 방법
- [ ] 주의사항 (있을 경우)

---

## 6. 커뮤니케이션 방식

### 불명확한 부분
**예시**:
- PLAN.md의 TBD 항목과 관련된 구현
- 요구사항이 충돌할 때
- 설계 결정이 필요할 때

**방법**: PM(사용자)에게 직접 물어보기 → 기다리기 → 답변 후 구현

### 완료 보고 형식

```
완료한 작업: [작업명]

변경된 파일:
- /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/src/providers/claude.ts: 추가 - Claude API 프로바이더 구현
- /Users/sanai/Desktop/ai_project/projects/cc_플러그인_개발/src/extension.ts: 수정 - 프로바이더 팩토리 로직 추가

실행 방법:
npm run compile && npm run lint

주의사항:
- Anthropic SDK 버전 0.24.0 이상 필요
- Claude 모델: claude-3-5-sonnet-20241022 사용
```

---

## 7. 특수한 상황별 가이드

### "이미 구현된 기능인데 내가 다시 구현해야 해?"
→ PLAN.md를 확인하고 PM과 상의. 중복 구현 방지.

### "다른 프로바이더(OpenAI 등)와 인터페이스가 맞지 않아"
→ Architect(또는 PM)에게 보고. 인터페이스 변경 검토.

### "API 키가 계속 없어 보여"
→ 로깅 추가하여 SecretStorage 호출 확인. 
→ VSCode 버전 확인 (1.85+ 필요).
→ 플랫폼별(macOS/Windows/Linux) 차이 검토.

### "VSCode 마켓플레이스 배포 방법?"
→ Phase 4에서 다룸. 현재는 로컬 테스트만 수행 (npm run dev).

---

## 8. 최종 체크리스트

작업 완료 후 반드시 확인:

- [ ] TypeScript 컴파일 성공: `npm run compile`
- [ ] ESLint 0 경고: `npm run lint`
- [ ] 코드 포매팅: `npm run format`
- [ ] 주석 검토 (불필요한 주석은 제거)
- [ ] AGENTS.md 규칙 준수 확인
- [ ] PLAN.md 업데이트 (해당 Phase 항목 체크)
- [ ] 변경된 파일 목록 PM에게 보고

---

**최종 업데이트**: 2026-06-23  
**버전**: 1.0  
**대상**: Claude AI Agent
