import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/payment-unit',
  workers: 1,
  outputDir: '/tmp/okim-payment-unit-results',
})
