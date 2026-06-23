const { build, context } = require('esbuild');

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
    sourcemap: true,
    minify: !watch,
  };

  if (watch) {
    const ctx = await context(config);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await build(config);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
