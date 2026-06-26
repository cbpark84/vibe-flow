# AI Agent 공유 지침서 (AGENTS.md)

**이 문서는 이 프로젝트에 참여하는 모든 AI 에이전트가 읽고 준수해야 하는 공유 지침입니다.**

---

## 1. 프로젝트 한눈에 보기

**Vibe Flow**: VSCode 사이드 패널에서 AI와 채팅하여 Claude Code처럼 코딩할 수 있는 플러그인. 
Claude, GPT, Gemini, 로컬 LLM 등 여러 LLM을 한 곳에서 관리하고, 파일 편집, 터미널 실행 등의 개발 작업을 AI의 지원을 받아 수행할 수 있다.

**핵심 특징**:
- 멀티 프로바이더: 4개 이상의 LLM 동시 지원
- 보안: API 키는 VSCode SecretStorage에만 저장
- 확장성: 플러그인 아키텍처로 신규 프로바이더/도구 추가 용이
- TypeScript strict mode 완전 준수

---

## 2. 핵심 아키텍처 원칙

### 2.1 프로바이더 인터페이스 준수 필수
모든 LLM 프로바이더(Claude, OpenAI, Gemini, Ollama)는 반드시 `src/providers/base.ts`에 정의된 `ILLMProvider` 인터페이스를 구현해야 한다.

```typescript
// src/providers/base.ts
interface ILLMProvider {
  readonly name: string;
  readonly maxTokens: number;
  initialize(apiKey: string): Promise<void>;
  chat(
    messages: ChatMessage[],
    tools?: Tool[]
  ): AsyncIterableIterator<string>;
  countTokens(text: string): Promise<number>;
}
```

**이유**: 프로바이더를 교체 가능하게 하기 위해. 새 프로바이더 추가 시 인터페이스를 변경하지 말고, Extension Host의 프로바이더 관리 코드만 수정한다.

### 2.2 WebView ↔ Extension 통신은 postMessage만 사용
절대 금지 사항:
- ❌ WebView에서 직접 파일 시스템 접근 (불가능, VSCode 샌드박스)
- ❌ WebView에서 직접 외부 API 호출 (불가능, 부가 권한 필요)
- ❌ import하여 직접 함수 호출

필수 방식:
```typescript
// WebView (src/webview/App.tsx)
const vscode = window.acquireVsCodeApi();
vscode.postMessage({
  type: 'read_file',
  payload: { filePath: '/path/to/file.ts' }
});

// Extension Host (src/extension.ts)
panel.webview.onDidReceiveMessage(async (message) => {
  if (message.type === 'read_file') {
    const content = await readFileFromDisk(message.payload.filePath);
    panel.webview.postMessage({
      type: 'file_content',
      payload: { content }
    });
  }
});
```

### 2.3 파일 시스템 접근은 반드시 `src/tools/fileSystem.ts` 통해서만
- 모든 파일 읽기/쓰기는 `src/tools/fileSystem.ts`의 export 함수 사용
- 직접 `fs` 모듈 사용 금지
- 이유: 보안 검증, 경로 이스케이프 방지, 테스트 용이성

```typescript
// 금지 ❌
import fs from 'fs';
const content = fs.readFileSync('/path/to/file', 'utf-8');

// 권장 ✅
import { readFile } from './tools/fileSystem';
const content = await readFile('/path/to/file');
```

### 2.4 API 키 절대 하드코딩 금지
- ❌ 코드/설정 파일에 API 키 직접 저장
- ❌ 환경 변수로 로드 후 메모리에 저장
- ✅ 모든 API 키는 `src/utils/secretStorage.ts`를 통해 관리

```typescript
// 권장 ✅
import { getSecret, setSecret } from './utils/secretStorage';

// API 키 저장
await setSecret('claude-api-key', userProvidedKey);

// API 키 조회
const apiKey = await getSecret('claude-api-key');
```

### 2.5 도구 호출(Tool Use)은 일관된 구조로
LLM이 파일 읽기/쓰기 등의 도구를 호출하면, 다음 순서를 따른다:
1. LLM이 도구 호출 요청 (JSON 형식)
2. Extension이 도구 실행 (작은 도구는 즉시, 파일 쓰기는 미리보기 제시)
3. 필요 시 사용자 승인 받음 (파일 쓰기, 터미널 실행)
4. 결과를 LLM에 다시 전달
5. LLM이 최종 응답 생성

---

## 3. 코딩 컨벤션

### 3.1 언어 및 타입
- **TypeScript**: 모든 코드는 TypeScript로 작성
- **Strict Mode**: `tsconfig.json`에서 `"strict": true` (변경 금지)
- **타입 안정성**: `any` 타입 사용 금지, 모든 함수 파라미터/반환값에 명시적 타입 선언
- **에러 처리**: 실제로 발생 가능한 에러만 catch, 나머지는 throws

```typescript
// 금지 ❌
function processMessage(msg: any) {
  return msg.content;
}

// 권장 ✅
interface Message {
  content: string;
  sender: 'user' | 'assistant';
}

function processMessage(msg: Message): string {
  return msg.content;
}
```

### 3.2 네이밍 컨벤션
| 대상 | 규칙 | 예시 |
|------|------|------|
| 인터페이스 | `I` 접두사 | `ILLMProvider`, `IChatMessage` |
| 클래스 | PascalCase | `ClaudeProvider`, `ChatManager` |
| 함수/메서드 | camelCase | `readFile`, `sendMessage` |
| 상수 | UPPER_SNAKE_CASE | `MAX_TOKEN_LIMIT`, `DEFAULT_TIMEOUT` |
| 파일명 | camelCase (도구/도구 아님) 또는 단어 소문자 | `fileSystem.ts`, `contextManager.ts` |
| 변수 | camelCase | `userInput`, `isLoading` |

### 3.3 주석 및 문서화
- **공개 함수/클래스**: JSDoc 필수
- **복잡한 로직**: 한 줄 주석 (Why, not What)
- **To-Do**: `// TODO: ` 형식

```typescript
/**
 * 파일 내용을 읽고 청킹합니다.
 * @param filePath - 읽을 파일 경로
 * @param maxChunkSize - 청크 최대 크기 (바이트)
 * @returns 청크 배열
 */
export async function readFileChunked(
  filePath: string,
  maxChunkSize: number = 4096
): Promise<string[]> {
  // VSCode의 파일 시스템 API 사용 (보안 관점)
  // ...
}
```

### 3.4 포매팅 및 린팅
- **Prettier**: 자동 포매팅 (프로젝트 규칙 준수)
- **ESLint**: 0 경고 목표
- **Pre-commit Hook**: 자동 린팅/포매팅

```bash
npm run lint    # 오류 확인
npm run format  # 자동 포매팅
```

### 3.5 로깅
- ❌ `console.log` 사용 금지
- ✅ VSCode OutputChannel 사용 (프로덕션, 디버깅)

```typescript
// 금지 ❌
console.log('Chat started');

// 권장 ✅
import { getLogger } from './utils/logger';
const logger = getLogger('ChatManager');
logger.info('Chat started');
```

---

## 4. 에이전트별 역할 지침

### 4.1 Architect (아키텍처 설계)
**책임**: 새 기능/프로바이더/도구 추가 시 설계 담당

**체크리스트**:
- [ ] 새 프로바이더 추가 시, `src/providers/base.ts`의 `ILLMProvider` 인터페이스 확인/수정 필요 여부 검토
- [ ] 새 도구 추가 시, `src/tools/types.ts`에 Tool 타입 정의
- [ ] postMessage 메시지 스키마 설계 (Extension ↔ WebView)
- [ ] 아키텍처 변경 시 PLAN.md 업데이트
- [ ] 순환 의존성 없음 확인

**산출물**: 설계 문서, 인터페이스 정의, 메시지 스키마

---

### 4.2 Developer (개발)
**책임**: 실제 코드 구현

**체크리스트**:
- [ ] PLAN.md의 Phase 순서 준수 (Phase 1 → 2 → 3 → 4)
- [ ] 각 Phase 완료 후 PLAN.md의 "개발 단계"에서 해당 항목 체크
- [ ] 새 파일 생성 전 디렉토리 구조 확인
- [ ] TypeScript strict mode 통과
- [ ] ESLint 0 경고
- [ ] 변경 파일 목록을 최종 보고에 포함

**금지 사항**:
- Architect의 설계 없이 인터페이스 변경 금지
- 한 PR에 여러 Phase 묶기 금지 (Phase별 분리)

---

### 4.3 Reviewer (코드 리뷰)
**책임**: 코드 품질 및 보안 검증

**필수 검토 항목**:
1. **보안**
   - [ ] API 키가 코드/설정에 하드코딩되지 않았는가?
   - [ ] SecretStorage를 사용하는가?
   - [ ] 파일 경로 검증이 있는가? (경로 이스케이프 방지)

2. **아키텍처 준수**
   - [ ] postMessage 패턴만 사용했는가?
   - [ ] 모든 프로바이더가 ILLMProvider 구현하는가?
   - [ ] 파일 시스템 접근이 fileSystem.ts를 통하는가?

3. **타입 안전성**
   - [ ] TypeScript strict mode 통과하는가?
   - [ ] `any` 타입이 없는가?
   - [ ] 모든 함수에 명시적 타입이 있는가?

4. **코드 스타일**
   - [ ] ESLint 통과하는가?
   - [ ] 네이밍 컨벤션을 따르는가?
   - [ ] 공개 함수에 JSDoc이 있는가?

---

### 4.4 QA (품질 보증)
**책임**: 기능 테스트 및 버그 리포트

**테스트 환경**:
- VSCode 1.85+ (최소 지원 버전)
- 플랫폼: macOS, Windows, Linux
- Node.js: 18+

**테스트 항목**:
- [ ] Extension 정상 로드
- [ ] 각 프로바이더별 API 연결 테스트
- [ ] 채팅 입출력 정상 작동
- [ ] 파일 읽기/쓰기 정상 작동
- [ ] API 키 저장/조회 보안 확인
- [ ] 메모리 누수 없음 (Chrome DevTools)

**테스트 도구**:
- `@vscode/test-electron`: Extension 통합 테스트
- VSCode DevTools: WebView 디버깅
- Chrome DevTools: WebView 성능 분석

---

### 4.5 PM / 오케스트레이터 (토큰 효율 규칙)
**책임**: 사용자 명령 분석, 에이전트 위임, 결과 통합

#### 에이전트 재사용 — 가장 중요한 규칙
서브에이전트가 불완전하게 종료되어 결과가 없을 때:
- ❌ 금지: 동일 작업을 새 에이전트로 처음부터 재실행
- ✅ 필수: `SendMessage(to: '<agentId>', ...)` 로 기존 에이전트를 이어서 실행

```
# 에이전트가 끊겼을 때 올바른 처리
# agentId는 이전 Agent 호출 결과에 포함됨
SendMessage(to: 'a60caf18f7561ed1d', "작업을 완료하고 결과를 보고해줘")
```

새 에이전트 생성 시 초기화 비용(시스템 프롬프트 + AGENTS.md + CLAUDE.md 로딩)이 매번 발생하므로, 기존 에이전트 재사용이 항상 우선이다.

#### 에이전트 생성 기준
| 상황 | 올바른 처리 |
|------|------------|
| 파일 1~2개, 단순 타입 수정 | PM이 직접 Edit 도구로 처리 |
| lint/compile 결과만 확인 | developer 프롬프트에 "완료 후 lint 실행하여 결과 포함해서 보고" 추가 |
| 코드 리뷰 필요 없는 단순 수정 | reviewer 생성 생략 |
| 복잡한 기능 구현, 보안 관련 변경 | developer → reviewer 순서 유지 |

#### 에이전트 프롬프트 작성 원칙
- developer에게 "lint/compile 실행 후 결과를 보고에 포함"을 명시하면 별도 reviewer 없이 검증 가능
- 한 에이전트가 여러 파일을 처리하도록 묶어서 지시 (파일당 에이전트 생성 금지)
- 프롬프트에 "완료 보고 형식"을 명시하여 에이전트가 중간에 끊기지 않도록 유도

---

## 5. 주요 파일 맵

에이전트가 빠르게 필요한 파일을 찾을 수 있도록:

| 목적 | 파일 | 담당 |
|------|------|------|
| **플러그인 진입점** | `src/extension.ts` | Developer |
| **WebView 진입점** | `src/webview/main.tsx` | Developer |
| **프로바이더 인터페이스** | `src/providers/base.ts` | Architect |
| **프로바이더 구현** | `src/providers/{claude,openai,gemini,local}.ts` | Developer |
| **도구 정의** | `src/tools/types.ts` | Architect |
| **도구 구현** | `src/tools/{fileSystem,terminal}.ts` | Developer |
| **API 키 보안** | `src/utils/secretStorage.ts` | Developer |
| **토큰 관리** | `src/utils/contextManager.ts` | Developer |
| **로깅** | `src/utils/logger.ts` | Developer |
| **타입 정의** | `src/utils/types.ts` | Architect |
| **채팅 UI** | `src/webview/components/ChatPanel.tsx` | Developer |
| **프로바이더 선택** | `src/webview/components/ProviderSelector.tsx` | Developer |
| **개발 계획** | `PLAN.md` | Architect/PM |
| **에이전트 지침** | `AGENTS.md` | Architect |
| **Claude 전용 지침** | `CLAUDE.md` | Claude |

---

## 6. 금지 사항 및 필수 사항

### 금지 ❌
| 항목 | 사유 |
|------|------|
| `console.log` | OutputChannel 사용할 것 |
| `any` 타입 | strict mode 위반 |
| API 키 하드코딩 | 보안 위협 |
| 직접 fs 모듈 사용 | fileSystem.ts 거칠 것 |
| WebView의 직접 파일 접근 | VSCode 샌드박스 위반 |
| postMessage 외 통신 방식 | 아키텍처 위반 |
| 사용자 승인 없이 파일 삭제 | 데이터 손실 위험 |
| 인터페이스 임의 변경 | 호환성 파괴 |

### 필수 ✅
| 항목 | 사유 |
|------|------|
| TypeScript strict mode | 타입 안전성 |
| ILLMProvider 구현 | 멀티 프로바이더 지원 |
| postMessage 통신 | VSCode 제약사항 |
| SecretStorage 사용 | API 키 보안 |
| JSDoc 주석 | 협업 효율성 |
| ESLint 0 경고 | 코드 품질 |
| PLAN.md 업데이트 | 프로젝트 추적 |

---

## 7. 문제 해결 가이드

### "VSCode API가 undefined"
- ✅ WebView에서만 `window.acquireVsCodeApi()` 호출
- ✅ Extension Host에서는 VSCode API 직접 import

### "파일을 읽을 수 없음"
- ✅ `src/tools/fileSystem.ts`의 함수 사용 확인
- ✅ 경로가 절대 경로인지 확인
- ✅ 파일 권한 확인

### "API 키가 보이지 않음"
- ✅ `secretStorage.setSecret()` 호출 확인
- ✅ 키 이름(identifier) 일치 확인
- ✅ VSCode가 정상 로드되었는지 확인

### "postMessage 타입 에러"
- ✅ WebView와 Extension의 메시지 타입 정의 일치 확인 (`src/utils/types.ts`)
- ✅ payload 구조 확인

---

## 8. 커뮤니케이션 규칙

에이전트 간 효율적인 협업을 위해:

- **이슈 리포트**: GitHub Issue로 기록 (제목, 현상, 재현 방법, 환경)
- **설계 검토**: PR 생성 전 Architect와 의논
- **릴리스**: Phase 완료 시 버전 태그 생성 (e.g., `v1.0.0-phase1`)
- **문서화**: 코드 변경 시 해당 문서(.md) 함께 업데이트

---

**마지막 업데이트**: 2026-06-26  
**버전**: 1.1  
**Audience**: All AI Agents
