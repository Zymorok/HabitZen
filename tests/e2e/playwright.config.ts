import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  outputDir: '../../storage/reports/e2e/artifacts',
  reporter: [['list'], ['json', { outputFile: '../../storage/reports/e2e/results.json' }]],
  use: {
    baseURL: process.env['HABITZEN_BASE_URL'] ?? 'http://localhost:8097',
    viewport: { width: 390, height: 844 },
    locale: 'ru-RU',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env['HABITZEN_CHROMIUM_PATH']
      ? { executablePath: process.env['HABITZEN_CHROMIUM_PATH'] }
      : {},
  },
});
