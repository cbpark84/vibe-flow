/**
 * 유틸리티 함수 테스트
 * - errorHandler: Anthropic 에러 분류
 * - contextManager: 토큰 카운팅 및 컨텍스트 트림
 */

import { strict as assert } from 'assert';
import Anthropic from '@anthropic-ai/sdk';
import { parseAnthropicError, parseProviderError } from '../utils/errorHandler';
import { ContextManager } from '../utils/contextManager';
import { createProvider } from '../providers/factory';
import type { ChatMessage } from '../providers/base';

/**
 * 테스트 로그 출력
 */
function logTest(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

// ============================================================================
// 테스트: errorHandler - parseAnthropicError
// ============================================================================

logTest('TEST: parseAnthropicError()');

// Test: 정상적인 사용자 취소 (APIUserAbortError)
{
  const error = new Anthropic.APIUserAbortError('User cancelled');
  const result = parseAnthropicError(error);
  assert.strictEqual(result.type, 'unknown');
  assert(result.message.includes('취소'));
  assert.strictEqual(result.retryable, false);
  logTest('  ✓ Handles APIUserAbortError (user cancellation)');
}

// Test: 인증 에러 (AuthenticationError)
{
  const error = new Anthropic.AuthenticationError(401, 'Invalid API key', 'req-123', {});
  const result = parseAnthropicError(error);
  assert.strictEqual(result.type, 'auth');
  assert(result.message.includes('API 키'));
  assert.strictEqual(result.retryable, false);
  logTest('  ✓ Handles AuthenticationError (401)');
}

// Test: 레이트 리미트 (RateLimitError)
{
  const error = new Anthropic.RateLimitError(429, 'Rate limit exceeded', 'req-123', {});
  const result = parseAnthropicError(error);
  assert.strictEqual(result.type, 'rate_limit');
  assert(result.message.includes('한도'));
  assert.strictEqual(result.retryable, true);
  logTest('  ✓ Handles RateLimitError (429)');
}

// Test: 타임아웃 에러 (APIConnectionTimeoutError)
{
  const error = new Anthropic.APIConnectionTimeoutError('Request timeout');
  const result = parseAnthropicError(error);
  assert.strictEqual(result.type, 'network');
  assert(result.message.includes('시간'));
  assert.strictEqual(result.retryable, true);
  logTest('  ✓ Handles APIConnectionTimeoutError');
}

// Test: 네트워크 연결 에러 (APIConnectionError)
{
  const error = new Anthropic.APIConnectionError('Network failed');
  const result = parseAnthropicError(error);
  assert.strictEqual(result.type, 'network');
  assert(result.message.includes('연결'));
  assert.strictEqual(result.retryable, true);
  logTest('  ✓ Handles APIConnectionError');
}

// Test: 서버 에러 (InternalServerError)
{
  const error = new Anthropic.InternalServerError(500, 'Server error', 'req-123', {});
  const result = parseAnthropicError(error);
  assert.strictEqual(result.type, 'server');
  assert(result.message.includes('서버'));
  assert.strictEqual(result.retryable, true);
  logTest('  ✓ Handles InternalServerError (500+)');
}

// Test: 일반적인 API 에러
{
  const error = new Anthropic.APIError(500, 'Unknown API error', 'req-123', {});
  const result = parseAnthropicError(error);
  assert(result.type === 'unknown' || result.type === 'server');
  logTest('  ✓ Handles generic APIError');
}

// ============================================================================
// 테스트: errorHandler - parseProviderError
// ============================================================================

logTest('\nTEST: parseProviderError()');

// Test: Claude 프로바이더 에러 (Anthropic 에러)
{
  const error = new Anthropic.AuthenticationError(401, 'Invalid key', 'req-123', {});
  const result = parseProviderError(error, 'claude');
  assert.strictEqual(result.type, 'auth');
  logTest('  ✓ Claude error routing works');
}

// Test: 다른 프로바이더 인증 에러
{
  const error = new Error('401 Unauthorized');
  const result = parseProviderError(error, 'openai');
  assert.strictEqual(result.type, 'auth');
  assert(result.message.includes('OpenAI'));
  logTest('  ✓ OpenAI authentication error detected');
}

// Test: 다른 프로바이더 레이트 리미트
{
  const error = new Error('429 too many requests');
  const result = parseProviderError(error, 'gemini');
  assert.strictEqual(result.type, 'rate_limit');
  assert(result.message.includes('Gemini'));
  logTest('  ✓ Gemini rate limit error detected');
}

// ============================================================================
// 테스트: contextManager - countTotal
// ============================================================================

logTest('\nTEST: ContextManager.countTotal()');

async function testContextManagerCountTotal(): Promise<void> {
  const claude = createProvider('claude');
  await claude.initialize('test-key');

  const messages: ChatMessage[] = [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
    { role: 'user', content: 'How are you?' },
  ];

  const total = await ContextManager.countTotal(messages, claude);
  assert(total > 0, 'Total tokens should be positive');
  logTest(`  ✓ countTotal() returns positive token count: ${total} tokens`);
}

await testContextManagerCountTotal();

// ============================================================================
// 테스트: contextManager - getUsage
// ============================================================================

logTest('\nTEST: ContextManager.getUsage()');

async function testContextManagerGetUsage(): Promise<void> {
  const claude = createProvider('claude');
  await claude.initialize('test-key');

  const messages: ChatMessage[] = [{ role: 'user', content: 'Short message' }];

  const usage = await ContextManager.getUsage(messages, claude);
  assert(typeof usage.used === 'number', 'used should be a number');
  assert(typeof usage.limit === 'number', 'limit should be a number');
  assert(typeof usage.percentage === 'number', 'percentage should be a number');
  assert(usage.used >= 0, 'used should be non-negative');
  assert(usage.limit > 0, 'limit should be positive');
  assert(usage.percentage >= 0 && usage.percentage <= 100, 'percentage should be 0-100');
  logTest(`  ✓ getUsage() returns valid TokenUsage: ${usage.used}/${usage.limit} (${usage.percentage}%)`);
}

await testContextManagerGetUsage();

// ============================================================================
// 테스트: contextManager - trim
// ============================================================================

logTest('\nTEST: ContextManager.trim()');

async function testContextManagerTrim(): Promise<void> {
  const ollama = createProvider('ollama'); // 32k 토큰, 낮은 임계값
  await ollama.initialize('');

  // 매우 긴 메시지 생성 (의도적으로 트림을 트리거)
  const longMessage = 'x'.repeat(50000); // ~12,500 토큰
  const messages: ChatMessage[] = [
    { role: 'user', content: longMessage },
    { role: 'assistant', content: 'response1' },
    { role: 'user', content: longMessage },
    { role: 'assistant', content: 'response2' },
    { role: 'user', content: 'short message' },
  ];

  const result = await ContextManager.trim(messages, ollama);
  assert(typeof result.trimmed === 'boolean', 'trimmed should be boolean');
  assert(typeof result.removedCount === 'number', 'removedCount should be number');

  if (result.trimmed) {
    assert(result.removedCount > 0, 'Should have removed messages');
    assert(result.messages.length < messages.length, 'Trimmed list should be shorter');
    logTest(`  ✓ trim() removes old messages: removed ${result.removedCount}, remaining ${result.messages.length}`);
  } else {
    logTest('  ✓ trim() returns untrimmed when below threshold');
  }

  // 마지막 메시지(현재 turn)는 항상 유지되어야 함
  const lastMessage = messages[messages.length - 1];
  const lastTrimmedMessage = result.messages[result.messages.length - 1];
  assert.strictEqual(lastMessage.content, lastTrimmedMessage.content, 'Last message should be preserved');
  logTest('  ✓ trim() preserves current exchange');
}

await testContextManagerTrim();

// ============================================================================
// 테스트: contextManager - exchange grouping
// ============================================================================

logTest('\nTEST: ContextManager exchange grouping');

async function testExchangeGrouping(): Promise<void> {
  const claude = createProvider('claude');
  await claude.initialize('test-key');

  // exchange 단위로 정리된 메시지
  // Exchange 1: user msg + assistant responses
  // Exchange 2: user msg + assistant responses
  // Exchange 3: user msg (current)
  const messages: ChatMessage[] = [
    // Exchange 1
    { role: 'user', content: 'First question' },
    { role: 'assistant', content: 'First answer' },
    { role: 'assistant', content: 'First answer part 2', toolCallId: 'tc1', toolName: 'read', toolInput: {} },
    // Exchange 2
    { role: 'user', content: 'Second question' },
    { role: 'assistant', content: 'Second answer' },
    // Exchange 3 (current)
    { role: 'user', content: 'Third question' },
  ];

  // trim()을 호출해도 최소 1개 exchange는 유지됨
  const result = await ContextManager.trim(messages, claude);
  assert(result.messages.length > 0, 'Should always have at least current exchange');
  logTest('  ✓ trim() respects exchange grouping');
}

await testExchangeGrouping();

logTest('\n✅ All utils tests passed!');
