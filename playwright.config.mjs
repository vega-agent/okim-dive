import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'python3 -m http.server 8080',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: true,
    timeout: 10_000,
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
