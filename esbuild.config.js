const { build, context } = require('esbuild');
const fs = require('fs');

const watch = process.argv.includes('--watch');

async function main() {
  const config = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    // performance: sourcemap은 개발(watch) 모드에서만 생성
    // production 빌드 시 .map 파일 미생성으로 배포 크기 감소
    sourcemap: watch,
    minify: !watch,
    treeShaking: true,
  };

  if (watch) {
    const ctx = await context(config);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await build(config);
    // performance: 번들 크기 리포트
    const stat = fs.statSync('dist/extension.js');
    const kb = (stat.size / 1024).toFixed(1);
    console.log(`Extension bundle: ${kb} KB`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
