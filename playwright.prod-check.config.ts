// 临时配置：对**已部署的生产栈**跑 e2e（baseURL 指向 :3000，不启 webServer）。
// 用法: npx playwright test --config=playwright.prod-check.config.ts e2e/security-variant.spec.ts
import { defineConfig, devices } from '@playwright/test';

const target = process.env.WM_PROD_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/security-variant.spec.ts',
  workers: 1,
  timeout: 90000,
  expect: { timeout: 30000 },
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: target,
    viewport: { width: 1280, height: 720 },
    colorScheme: 'dark',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        launchOptions: {
          args: ['--use-angle=swiftshader', '--use-gl=swiftshader'],
        },
      },
    },
  ],
});
