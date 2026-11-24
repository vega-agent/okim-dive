import { defineConfig } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL
if (!baseURL || !['http://localhost:3100', 'http://127.0.0.1:3100'].includes(baseURL) ||
    process.env.AUTH_URL !== baseURL || process.env.OKIM_DISABLE_EMAILS !== '1') {
  throw new Error('Set PLAYWRIGHT_BASE_URL and AUTH_URL to the same explicit loopback port 3100 origin and OKIM_DISABLE_EMAILS=1.')
}

export default defineConfig({
  testDir: './tests', testMatch: 'multi-deposit.spec.mjs', workers: 1, retries: 0,
  outputDir: '/tmp/okim-payment-integration-results', use: { baseURL, reducedMotion: 'reduce' },
})
