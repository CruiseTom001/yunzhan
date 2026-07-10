import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import Inspector from 'unplugin-vue-dev-locator/vite'

const enableInspector = process.env.VITE_ENABLE_INSPECTOR === 'true'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  // Electron 使用 file:// 协议，需要相对路径
  base: './',
  build: {
    sourcemap: 'hidden',
    chunkSizeWarningLimit: 4500,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-highlight': ['highlight.js'],
          'vendor-markdown': ['markdown-it'],
          'vendor-lucide': ['lucide-vue-next'],
        },
      },
    },
  },
  plugins: [
    vue(),
    enableInspector ? Inspector() : false,
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // ✅ 定义 @ = src
    },
  },
})
