import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const repoRoot = '/Users/hyungeunseanson/Documents/서비스/locally-web';
const nodePath = `${repoRoot}/node_modules`;
const renderScriptPath = `${repoRoot}/scripts/email-render-analysis.cjs`;

type RenderAnalysisEntry = {
  name: string;
  outputPath: string;
  subject: string;
  preheader: string;
  htmlLength: number;
  accentLine2px: boolean;
  mobileFirstCta: boolean;
  markers: Record<string, boolean>;
};

function runRenderAnalysis(): RenderAnalysisEntry[] {
  const output = execFileSync(
    '/bin/zsh',
    ['-lc', `NODE_PATH=${nodePath} node ${renderScriptPath}`],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        NODE_OPTIONS: '',
      },
      encoding: 'utf8',
    }
  );

  return JSON.parse(output) as RenderAnalysisEntry[];
}

function getResult(results: RenderAnalysisEntry[], name: string) {
  const result = results.find((entry) => entry.name === name);
  expect(result, `missing render analysis result for ${name}`).toBeTruthy();
  return result!;
}

async function getViewportMetrics(page: import('@playwright/test').Page, outputPath: string) {
  await page.goto(`file://${outputPath}`);

  return page.evaluate(() => {
    const cta = document.querySelector('.locally-email-cta');
    const title = document.querySelector('.locally-email-title');
    const container = document.querySelector('.locally-email-container');
    const panel = document.querySelector('.locally-email-panel');
    const compactRows = Array.from(document.querySelectorAll('.locally-email-kv-row'));
    const ctaBox = cta?.getBoundingClientRect();
    const titleBox = title?.getBoundingClientRect();
    const containerBox = container?.getBoundingClientRect();
    const panelBox = panel?.getBoundingClientRect();

    return {
      bodyBg: getComputedStyle(document.body).backgroundColor,
      ctaBox: ctaBox ? {
        width: Math.round(ctaBox.width),
        height: Math.round(ctaBox.height),
        x: Math.round(ctaBox.x),
      } : null,
      titleBox: titleBox ? {
        width: Math.round(titleBox.width),
        height: Math.round(titleBox.height),
      } : null,
      containerBox: containerBox ? {
        width: Math.round(containerBox.width),
        x: Math.round(containerBox.x),
      } : null,
      panelBox: panelBox ? {
        width: Math.round(panelBox.width),
        height: Math.round(panelBox.height),
        x: Math.round(panelBox.x),
      } : null,
      compactRowHeights: compactRows.map((row) => Math.round(row.getBoundingClientRect().height)),
    };
  });
}

test.describe('Templated email mobile and desktop design contracts', () => {
  let results: RenderAnalysisEntry[];

  test.beforeAll(() => {
    results = runRenderAnalysis();
  });

  test('booking confirmed render keeps a compact mobile-first hierarchy', () => {
    const result = getResult(results, 'email_booking_confirmed_after');
    const html = readFileSync(result.outputPath, 'utf8');

    expect(result.accentLine2px).toBe(false);
    expect(result.markers['예약 정보']).toBe(true);
    expect(result.markers['예약 접수']).toBe(true);
    expect(result.markers['새 예약이 접수되었습니다']).toBe(true);
    expect(result.markers['예약 상세 확인하기']).toBe(true);
    expect(result.mobileFirstCta).toBe(true);
    expect(html).toContain('background-color:#111111');
    expect(html).toContain('padding:14px 22px');
    expect(html).toContain('border-radius:999px');
    expect(html).toContain('height:6px');
    expect(html).toContain('background-color:#FFFFFF;border:1px solid #E8E8E8;border-radius:14px');
    expect(html).toContain('box-shadow:none');
    expect(html).toContain('border-bottom:1px solid #F0F0F0');
    expect(html).toContain('letter-spacing:0');
    expect(html).not.toContain('locally-email-accent');
    expect(html).not.toContain('background-color:#FFF3F5;border-color:#FFD2DC');
  });

  test('booking cancelled render keeps status/title split and compact ticket rows', () => {
    const result = getResult(results, 'email_booking_cancelled_after');
    const html = readFileSync(result.outputPath, 'utf8');

    expect(result.accentLine2px).toBe(false);
    expect(result.markers['예약 정보']).toBe(true);
    expect(result.markers['예약 취소']).toBe(true);
    expect(result.markers['예약이 취소되었습니다']).toBe(true);
    expect(result.markers['내 여행 보기']).toBe(true);
    expect(result.mobileFirstCta).toBe(true);
    expect(html).toContain('padding:7px 0');
    expect(html).toContain('font-size:13px');
    expect(html).toContain('padding:14px 22px');
    expect(html).toContain('min-height:48px');
  });

  test('ops notice render uses a structured body card and localized ops footer', () => {
    const result = getResult(results, 'email_notice_custom_after');
    const html = readFileSync(result.outputPath, 'utf8');

    expect(result.accentLine2px).toBe(false);
    expect(result.markers['확인 내용']).toBe(true);
    expect(result.markers['Locally 운영 업데이트']).toBe(true);
    expect(result.markers['운영 대시보드 보기']).toBe(true);
    expect(result.markers['확인 필요']).toBe(true);
    expect(html).toContain('Locally 내부 운영 안내 메일');
    expect(result.mobileFirstCta).toBe(true);
    expect(html).toContain('background-color:#FFFFFF;border:1px solid #E8E8E8;border-radius:14px');
    expect(html).toContain('font-size:14px');
  });

  test('booking confirmed mobile viewport is edge-to-edge with full-width CTA', async ({ page }) => {
    const result = getResult(results, 'email_booking_confirmed_after');
    await page.setViewportSize({ width: 390, height: 1100 });

    const metrics = await getViewportMetrics(page, path.resolve(result.outputPath));

    expect(metrics.bodyBg).toBe('rgb(255, 255, 255)');
    expect(metrics.containerBox).toEqual({ width: 390, x: 0 });
    expect(metrics.ctaBox).toEqual({ width: 350, height: 48, x: 20 });
    expect(metrics.panelBox).toEqual({ width: 350, height: 248, x: 20 });
    expect(metrics.compactRowHeights).toEqual([34, 34, 34, 34]);
    expect(metrics.titleBox?.width).toBe(350);
  });

  test('booking confirmed desktop viewport keeps centered card and compact CTA', async ({ page }) => {
    const result = getResult(results, 'email_booking_confirmed_after');
    await page.setViewportSize({ width: 900, height: 1100 });

    const metrics = await getViewportMetrics(page, path.resolve(result.outputPath));

    expect(metrics.bodyBg).toBe('rgb(247, 247, 247)');
    expect(metrics.containerBox).toEqual({ width: 600, x: 150 });
    expect(metrics.panelBox).toEqual({ width: 536, height: 252, x: 182 });
    expect(metrics.compactRowHeights).toEqual([34, 34, 34, 34]);
    expect(metrics.ctaBox?.height).toBe(48);
    expect(metrics.ctaBox?.width).toBeLessThan(200);
    expect(metrics.ctaBox?.x).toBeGreaterThan(150);
  });
});
