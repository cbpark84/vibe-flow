import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/webview',
  base: './',
  build: {
    outDir: '../../dist/webview',
    emptyOutDir: true,
    // performance: es2020 타겟으로 폴리필 최소화
    target: 'es2020',
    // performance: esbuild minifier 사용 (terser보다 5-10배 빠름)
    minify: 'esbuild',
    // performance: CSS 압축
    cssMinify: true,
    // performance: WebView는 단일 CSS 파일이 적합 (code split 불필요)
    cssCodeSplit: false,
    // performance: gzip 크기 계산 생략으로 빌드 속도 향상
    reportCompressedSize: false,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/webview/index.html'),
      output: {
        format: 'iife',
        name: 'VibeFlow',
        // performance: 추가 공백 제거
        compact: true,
      },
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'src/utils'),
    },
  },
});
