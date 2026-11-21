import { defineConfig, devices } from '@playwright/test';

// M2: primary target is the Next.js app (port 3100; 3000 is occupied by another
// local app). A static reference server (port 8080) serves legacy-static/* for the
// parity spec. Run `npm run build` before `npm run test:ui` so `next start` has artifacts.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3100',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run start -- -p 3100',
      url: 'http://localhost:3100',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'python3 -m http.server 8080',
      url: 'http://127.0.0.1:8080',
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
  projects: [
    // Public-page specs assert the exact /trips list; trip-mutation specs run
    // afterwards in a dependent project so a temporarily published fixture trip
    // can never race them (M5 item 6).
    { name: 'chromium-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } }, testIgnore: ['m5-trips-lifecycle.spec.mjs', 'customer-setup.spec.mjs', 'm5-policies-publish.spec.mjs', 'm6-integration.spec.mjs', 'diver-equipment.spec.mjs'] },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: ['m5-trips-lifecycle.spec.mjs', 'customer-setup.spec.mjs', 'm5-policies-publish.spec.mjs', 'm6-integration.spec.mjs', 'diver-equipment.spec.mjs'] },
    { name: 'chromium-mutations', use: { ...devices['Desktop Chrome'] }, testMatch: ['m5-trips-lifecycle.spec.mjs', 'customer-setup.spec.mjs', 'm5-policies-publish.spec.mjs', 'm6-integration.spec.mjs', 'diver-equipment.spec.mjs'], dependencies: ['chromium-mobile', 'chromium-desktop'] },
  ],
});