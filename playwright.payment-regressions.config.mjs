import { defineConfig } from '@playwright/test'

// Guarded by local-payment-db.mjs. These cases need only disposable PostgreSQL.
export default defineConfig({
  testDir: './tests',
  testMatch: ['m5-trips-lifecycle.spec.mjs', 'm5-financial.spec.mjs', 'seamless-flow.spec.mjs',
    'completion-critical.spec.mjs', 'completion-points.spec.mjs'],
  workers: 1,
  retries: 0,
  outputDir: '/tmp/okim-payment-regression-results',
})
