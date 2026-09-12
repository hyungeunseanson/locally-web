import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

// This fixture checks stacking and hit testing using production classes, not
// authentication, React state transitions, or message APIs. Keep those in E2E.
const chatSource = readFileSync('app/admin/dashboard/components/ChatMonitor.tsx', 'utf8');
const sidebarSource = readFileSync('app/admin/dashboard/components/Sidebar.tsx', 'utf8');
const chatClasses = chatSource.match(/selectedInquiry \? '(flex fixed[^']+)'/)![1];
const sidebarClasses = [...sidebarSource.matchAll(/className="(md:hidden fixed[^"\n]+)"/g)]
  .map((match) => match[1]);
const profileSource = readFileSync('app/admin/dashboard/components/ChatParticipantProfileModal.tsx', 'utf8');
const profileClasses = profileSource.match(/className=\{`(fixed inset-0[^$]+)\$\{/)![1];
let css: string;

test.beforeAll(async () => {
  css = (await postcss([tailwind()]).process('@import "tailwindcss";', {
    from: resolve('app/admin-chat-layer-fixture.css'),
  })).css;
});

for (const width of [375, 390, 767, 768, 1280]) {
  test(`chat leaves navigation usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    // Fail on accidental external access. All markup, CSS and interactions are local.
    await page.route('**/*', (route) => route.abort());
    await page.setContent(`<style>${css}</style>
      <div class="flex min-h-screen">
        <div class="md:hidden">
          <header class="${sidebarClasses[0]}">
            <button id="toggle" style="margin-left:auto" onclick="document.querySelector('#overlay').hidden=false">Menu</button>
          </header>
          <div id="overlay" hidden>
            <div id="backdrop" class="${sidebarClasses[1]}" onclick="this.parentElement.hidden=true"></div>
            <aside id="menu" class="${sidebarClasses[2]}">
              <button id="navigate" style="margin-top:100px" onclick="this.textContent='Navigated'">Navigate</button>
              <button id="close" onclick="document.querySelector('#overlay').hidden=true">Close</button>
            </aside>
          </div>
        </div>
        <main class="flex-1 p-2 pt-16 md:p-8 md:pt-8 overflow-y-auto h-screen">
          <div class="max-w-7xl mx-auto">
            <div class="bg-white p-2 md:p-6 min-h-[80vh] flex flex-col h-full lg:h-auto overflow-hidden lg:overflow-visible">
              <div class="animate-in fade-in duration-200 flex flex-col flex-1">
                <div class="flex relative">
                  <div id="chat" class="bg-white ${chatClasses}">
                    <textarea aria-label="Draft"></textarea>
                  </div>
                  <div id="profile" hidden class="${profileClasses}">Profile</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>`);

    if (width >= 768) {
      await expect(page.locator('#chat')).toHaveCSS('position', 'static');
      await expect(page.locator('#chat')).toHaveCSS('z-index', '0');
      await expect(page.locator('#toggle')).toBeHidden();
      return;
    }

    await expect(page.locator('#chat')).toHaveCSS('position', 'fixed');
    await expect(page.locator('#chat')).toHaveCSS('top', '56px');
    await page.getByRole('textbox', { name: 'Draft' }).fill('Keep this draft');
    await page.locator('#toggle').click();
    // Visibility alone passes even when another layer intercepts the menu.
    await expect.poll(() => page.evaluate(() => [
      document.elementFromPoint(100, 250)?.id,
      document.elementFromPoint(innerWidth - 20, 250)?.id,
    ])).toEqual(['menu', 'backdrop']);
    await page.locator('#navigate').click();
    await expect(page.locator('#navigate')).toHaveText('Navigated');
    await page.locator('#close').click();
    await expect(page.locator('#menu')).toBeHidden();
    await page.locator('#toggle').click();
    await page.mouse.click(width - 20, 250);
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Draft' })).toHaveValue('Keep this draft');
    await page.getByRole('textbox', { name: 'Draft' }).fill('Still editable');
    await page.locator('#toggle').click();
    await page.locator('#profile').evaluate((element) => { element.removeAttribute('hidden'); });
    await expect.poll(() => page.evaluate(() => document.elementFromPoint(100, 250)?.id))
      .toBe('profile');
  });
}
