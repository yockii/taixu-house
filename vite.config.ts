import { defineConfig } from 'vite';

// GH Pages 项目站点在 /taixu-house/ 子路径；本地 dev 保持根路径。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/taixu-house/' : '/',
  server: { port: 5173 },
  build: { target: 'es2022', outDir: 'dist' },
}));
