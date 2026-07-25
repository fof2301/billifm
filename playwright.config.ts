import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5173', ...devices['iPhone 13'] },
  webServer: {
    command: 'pnpm --filter @story/web dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
