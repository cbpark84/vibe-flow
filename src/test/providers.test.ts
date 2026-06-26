/**
 * 프로바이더 인터페이스 및 팩토리 테스트
 */

import { strict as assert } from 'assert';
import { createProvider, ProviderKey } from '../providers/factory';
import { ILLMProvider } from '../providers/base';

/**
 * 테스트 헬퍼: 프로바이더가 ILLMProvider 인터페이스를 올바르게 구현했는지 확인
 */
function assertImplementsILLMProvider(provider: ILLMProvider): void {
  assert(typeof provider.name === 'string', 'provider.name must be a string');
  assert(typeof provider.maxTokens === 'number', 'provider.maxTokens must be a number');
  assert(provider.maxTokens > 0, 'provider.maxTokens must be positive');
  assert(typeof provider.initialize === 'function', 'provider.initialize must be a function');
  assert(typeof provider.chat === 'function', 'provider.chat must be a function');
  assert(typeof provider.countTokens === 'function', 'provider.countTokens must be a function');
}

/**
 * 테스트 로그 출력
 */
function logTest(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

// ============================================================================
// 테스트: 팩토리 함수
// ============================================================================

logTest('TEST: createProvider(name)');

// Test: Valid provider names
for (const providerName of ['claude', 'openai', 'gemini', 'ollama'] as ProviderKey[]) {
  const provider = createProvider(providerName);
  assert(provider !== null, `createProvider('${providerName}') should not return null`);
  assertImplementsILLMProvider(provider);
  logTest(`  ✓ createProvider('${providerName}') returns valid ILLMProvider`);
}

// Test: Case insensitivity
const provider1 = createProvider('Claude');
const provider2 = createProvider('CLAUDE');
assert.strictEqual(provider1.name, provider2.name);
logTest('  ✓ createProvider() is case-insensitive');

// Test: Invalid provider name
try {
  createProvider('invalid_provider');
  assert.fail('should throw error for invalid provider');
} catch (error) {
  assert((error as Error).message.includes('Unknown provider'));
  logTest('  ✓ createProvider() throws error for unknown provider');
}

// ============================================================================
// 테스트: 프로바이더별 이름과 최대 토큰
// ============================================================================

logTest('\nTEST: Provider-specific properties');

{
  const claude = createProvider('claude');
  assert.strictEqual(claude.name, 'Claude', 'Claude provider name');
  assert.strictEqual(claude.maxTokens, 200000, 'Claude maxTokens');
  logTest('  ✓ Claude provider properties correct');
}

{
  const openai = createProvider('openai');
  assert.strictEqual(openai.name, 'OpenAI', 'OpenAI provider name');
  assert.strictEqual(openai.maxTokens, 128000, 'OpenAI maxTokens');
  logTest('  ✓ OpenAI provider properties correct');
}

{
  const gemini = createProvider('gemini');
  assert.strictEqual(gemini.name, 'Gemini', 'Gemini provider name');
  assert.strictEqual(gemini.maxTokens, 1000000, 'Gemini maxTokens');
  logTest('  ✓ Gemini provider properties correct');
}

{
  const ollama = createProvider('ollama');
  assert.strictEqual(ollama.name, 'Ollama', 'Ollama provider name');
  assert.strictEqual(ollama.maxTokens, 32000, 'Ollama maxTokens');
  logTest('  ✓ Ollama provider properties correct');
}

// ============================================================================
// 테스트: 프로바이더별 초기화
// ============================================================================

logTest('\nTEST: Provider initialization');

// Claude 프로바이더 초기화 (유효한 키 필요)
async function testClaudeInitialization(): Promise<void> {
  const claude = createProvider('claude');

  // 공백 API 키로 초기화 시도 (SDK 레벨에서 에러 발생하지 않음)
  try {
    await claude.initialize('sk-test-invalid-key-format');
    logTest('  ✓ Claude initialize() accepts key format');
  } catch (error) {
    assert.fail(`Claude initialize should not throw: ${(error as Error).message}`);
  }

  // initialize 없이 chat() 호출 시 에러
  const uninitialized = createProvider('claude');
  try {
    const it = uninitialized.chat([{ role: 'user', content: 'test' }]);
    await it.next();
    assert.fail('should throw error when chat() called before initialize()');
  } catch (error) {
    assert((error as Error).message.includes('not initialized'));
    logTest('  ✓ Claude chat() throws error before initialize()');
  }
}

// OpenAI 프로바이더 초기화
async function testOpenAIInitialization(): Promise<void> {
  const openai = createProvider('openai');
  try {
    await openai.initialize('sk-proj-test-key');
    logTest('  ✓ OpenAI initialize() accepts key format');
  } catch (error) {
    assert.fail(`OpenAI initialize should not throw: ${(error as Error).message}`);
  }
}

// Ollama는 API 키 불필요
async function testOllamaInitialization(): Promise<void> {
  const ollama = createProvider('ollama');
  try {
    await ollama.initialize('');
    logTest('  ✓ Ollama initialize() works with empty key (not required)');
  } catch (error) {
    assert.fail(`Ollama initialize should not throw: ${(error as Error).message}`);
  }
}

await Promise.all([testClaudeInitialization(), testOpenAIInitialization(), testOllamaInitialization()]);

// ============================================================================
// 테스트: countTokens
// ============================================================================

logTest('\nTEST: Token counting');

async function testTokenCounting(): Promise<void> {
  const claude = createProvider('claude');
  const shortText = 'Hello';
  const longText = 'Hello world'.repeat(100);

  const shortTokens = await claude.countTokens(shortText);
  const longTokens = await claude.countTokens(longText);

  assert(shortTokens > 0, 'Short text should have positive tokens');
  assert(longTokens > shortTokens, 'Longer text should have more tokens');
  logTest(`  ✓ countTokens works: "${shortText}" = ${shortTokens} tokens, long text = ${longTokens} tokens`);
}

await testTokenCounting();

logTest('\n✅ All provider tests passed!');
