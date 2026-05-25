import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer/src')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Each test file should be hermetic — no shared module state. The
    // secure-keys cache and zustand stores are module-scoped, so resetting
    // ensures one test can't pollute another.
    isolate: true
  }
})
