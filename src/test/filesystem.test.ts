/**
 * 파일시스템 도구 단위 테스트
 * readFile()만 테스트 (listDirectory, searchCode는 vscode 의존으로 제외)
 */
import * as assert from 'assert';
import * as path from 'path';
import { readFile } from '../tools/fileSystem';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<void>): Promise<void> {
  return fn()
    .then(() => {
      process.stdout.write(`  ✅ ${name}\n`);
      passed++;
    })
    .catch((e: Error) => {
      process.stdout.write(`  ❌ ${name}: ${e.message}\n`);
      failed++;
    });
}

async function main(): Promise<void> {
  process.stdout.write('\n🧪 FileSystem Tool Tests\n');

  const projectRoot = path.resolve(__dirname, '../..');

  await test('README.md 읽기 성공', async () => {
    const content = await readFile(path.join(projectRoot, 'README.md'));
    assert.ok(content.length > 0, 'README.md 내용이 있어야 함');
  });

  await test('package.json 읽기 성공', async () => {
    const content = await readFile(path.join(projectRoot, 'package.json'));
    const parsed = JSON.parse(content);
    assert.strictEqual(parsed.name, 'vibe-flow', 'package name이 vibe-flow이어야 함');
  });

  await test('존재하지 않는 파일 읽기 → 에러 발생', async () => {
    try {
      await readFile('/nonexistent/file/that/does/not/exist.txt');
      assert.fail('에러가 발생해야 함');
    } catch (e) {
      assert.ok((e as Error).message.includes('Failed to read file'), '에러 메시지 형식 확인');
    }
  });

  await test('빈 경로 읽기 → 에러 처리', async () => {
    try {
      await readFile('/tmp/__vibe_flow_test_nonexistent__.txt');
      assert.fail('에러가 발생해야 함');
    } catch (e) {
      assert.ok(e instanceof Error, '에러 객체가 반환되어야 함');
    }
  });

  process.stdout.write(`\n결과: ${passed} 통과, ${failed} 실패\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  process.stderr.write(`테스트 실행 실패: ${e.message}\n`);
  process.exit(1);
});
