import { chromium, devices } from '@playwright/test';

const profileDir = process.argv[2];
const mode = process.argv[3] || 'desktop';

if (!profileDir) {
  console.error('profile_dir_missing');
  process.exit(1);
}

const options =
  mode === 'mobile'
    ? { ...devices['iPhone 13'] }
    : { viewport: { width: 1440, height: 1100 } };

const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless: true,
  locale: 'ko-KR',
  ...options,
});

const page = context.pages()[0] || (await context.newPage());
await page.goto('https://mail.google.com/mail/u/0/#inbox', { waitUntil: 'networkidle' });
const bodyText = await page.locator('body').innerText();

console.log(
  JSON.stringify(
    {
      mode,
      title: await page.title(),
      url: page.url(),
      bodySnippet: bodyText.slice(0, 800),
    },
    null,
    2
  )
);

await context.close();
