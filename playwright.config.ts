import { defineConfig, devices } from '@playwright/test';

const legacyPopupDismissedAt = String(Date.now());
const legacyPopupStorageState = {
    cookies: [],
    origins: ['http://localhost:3000', 'http://127.0.0.1:3000'].map((origin) => ({
        origin,
        localStorage: [
            {
                name: 'locally_legacy_popup_closed_at',
                value: legacyPopupDismissedAt,
            },
        ],
    })),
};

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './tests/e2e',
    globalSetup: './tests/e2e/global.setup.ts',
    /* Run tests in files in parallel */
    fullyParallel: false,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: 'html',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://localhost:3000',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',
        viewport: { width: 1280, height: 720 },
        // Most tests exercise the page behind this first-visit notice. The popup's
        // dedicated contract test clears this key before navigation.
        storageState: legacyPopupStorageState,
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    // webServer: {
    //   command: 'npm run start',
    //   url: 'http://localhost:3000',
    //   reuseExistingServer: !process.env.CI,
    // },
});
