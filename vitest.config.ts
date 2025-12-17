import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['scripts/**/*.test.ts', 'scanner/**/*.test.ts', 'app/**/*.test.ts'],
  },
})
