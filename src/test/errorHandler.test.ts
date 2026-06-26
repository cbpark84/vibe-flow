/**
 * 에러 핸들러 단위 테스트
 * parseProviderError()에 일반 Error 객체로 테스트 (Anthropic SDK 클래스 제외)
 */
import * as assert from 'assert';
import { parseProviderError } from '../utils/errorHandler';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`  ✅ ${name}\n`);
    passed++;
  } catch (e) {
    process.stdout.write(`  ❌ ${name}: ${(e as Error).message}\n`);
    failed++;
  }
}

process.stdout.write('\n🧪 Error Handler Tests\n');

// --- OpenAI 에러 파싱 (provider='openai') ---
test('OpenAI 401 에러 → auth 타입, 재시도 불가', () => {
  const err = new Error('401 Unauthorized: Invalid API key');
  const result = parseProviderError(err, 'openai');
  assert.strictEqual(result.type, 'auth', `type이 auth이어야 함, 실제: ${result.type}`);
  assert.strictEqual(result.retryable, false, '재시도 불가여야 함');
});

test('OpenAI 인증 에러 → auth 타입', () => {
  const err = new Error('authentication failed');
  const result = parseProviderError(err, 'openai');
  assert.strictEqual(result.type, 'auth');
});

test('OpenAI 429 에러 → rate_limit 타입, 재시도 가능', () => {
  const err = new Error('429 Too Many Requests: rate limit exceeded');
  const result = parseProviderError(err, 'openai');
  assert.strictEqual(result.type, 'rate_limit', `type이 rate_limit이어야 함, 실제: ${result.type}`);
  assert.strictEqual(result.retryable, true, '재시도 가능이어야 함');
});

test('OpenAI 네트워크 에러 → network 타입, 재시도 가능', () => {
  const err = new Error('network error: ECONNREFUSED');
  const result = parseProviderError(err, 'openai');
  assert.strictEqual(result.type, 'network', `type이 network이어야 함, 실제: ${result.type}`);
  assert.strictEqual(result.retryable, true);
});

test('OpenAI 타임아웃 에러 → network 타입, 재시도 가능', () => {
  const err = new Error('timeout exceeded');
  const result = parseProviderError(err, 'openai');
  assert.strictEqual(result.type, 'network');
  assert.strictEqual(result.retryable, true);
});

test('알 수 없는 에러 → unknown 타입', () => {
  const err = new Error('Something went wrong unexpectedly');
  const result = parseProviderError(err, 'openai');
  assert.strictEqual(result.type, 'unknown');
});

// --- Gemini 에러 ---
test('Gemini 401 에러 → auth 타입', () => {
  const err = new Error('401: API key not valid');
  const result = parseProviderError(err, 'gemini');
  assert.strictEqual(result.type, 'auth');
  assert.strictEqual(result.retryable, false);
});

// --- 에러 메시지 포함 확인 ---
test('결과에 message 필드가 있음', () => {
  const err = new Error('test error');
  const result = parseProviderError(err, 'openai');
  assert.ok(result.message, 'message가 있어야 함');
  assert.ok(result.message.length > 0, 'message가 비어있지 않아야 함');
});

// --- 비 Error 객체 처리 ---
test('Error가 아닌 객체 → unknown 타입', () => {
  const result = parseProviderError('string error', 'openai');
  assert.strictEqual(result.type, 'unknown');
});

test('null 입력 → unknown 타입', () => {
  const result = parseProviderError(null, 'openai');
  assert.strictEqual(result.type, 'unknown');
});

process.stdout.write(`\n결과: ${passed} 통과, ${failed} 실패\n`);
if (failed > 0) process.exit(1);
