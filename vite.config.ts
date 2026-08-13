import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 纯静态站点配置：
// - base: './' 使用相对路径，产物可被任意静态托管（Cloudflare Pages / Netlify / Nginx）直接服务
// - 产物输出到 dist/，对应 Cloudflare Pages 的「输出目录」
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
});
