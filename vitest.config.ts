import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    projects: [
      {
        name: 'node',
        include: ['server/**/*.test.mjs', 'electron/**/*.test.mjs', 'scripts/**/*.test.mjs'],
        environment: 'node',
      },
      {
        name: 'jsdom',
        include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
        environment: 'jsdom',
      },
    ],
  },
})
