import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'scanner/**/*.test.ts', 'app/**/*.test.ts', 'lib/**/*.test.ts'],
  },
})
