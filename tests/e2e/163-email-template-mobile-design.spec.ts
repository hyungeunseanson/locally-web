import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
  compactButtonStyleDetected: boolean;
  markers: Record<string, boolean>;
};

function runRenderAnalysis(): RenderAnalysisEntry[] {
  const output = execFileSync(
    '/bin/zsh',
    ['-lc', `NODE_PATH=${nodePath} node ${renderScriptPath}`],
    {
      cwd: repoRoot,
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

test.describe('Templated email mobile design contracts', () => {
  let results: RenderAnalysisEntry[];

  test.beforeAll(() => {
    results = runRenderAnalysis();
  });

  test('booking confirmed render keeps a compact mobile-first hierarchy', () => {
    const result = getResult(results, 'email_booking_confirmed_after');
    const html = readFileSync(result.outputPath, 'utf8');

    expect(result.accentLine2px).toBe(true);
    expect(result.markers['예약 정보']).toBe(true);
    expect(result.markers['예약 접수']).toBe(true);
    expect(result.markers['새 예약이 접수되었습니다']).toBe(true);
    expect(result.markers['예약 상세 확인하기']).toBe(true);
    expect(html).toContain('font-size:13px');
    expect(html).toContain('padding:11px 18px');
    expect(html).toContain('border-radius:10px');
    expect(html).toContain('background-color:#F8FAFC;border:1px solid #E5E7EB;border-radius:14px');
  });

  test('booking cancelled render keeps status/title split and stacked summary rows', () => {
    const result = getResult(results, 'email_booking_cancelled_after');
    const html = readFileSync(result.outputPath, 'utf8');

    expect(result.accentLine2px).toBe(true);
    expect(result.markers['예약 정보']).toBe(true);
    expect(result.markers['예약 취소']).toBe(true);
    expect(result.markers['예약이 취소되었습니다']).toBe(true);
    expect(result.markers['내 여행 보기']).toBe(true);
    expect(html).toContain('padding:0 0 10px');
    expect(html).toContain('padding-bottom:0');
    expect(html).toContain('font-size:13px');
    expect(html).toContain('padding:11px 18px');
    expect(html).not.toContain('min-height:48px');
  });

  test('ops notice render uses a structured body card and localized ops footer', () => {
    const result = getResult(results, 'email_notice_custom_after');
    const html = readFileSync(result.outputPath, 'utf8');

    expect(result.accentLine2px).toBe(true);
    expect(result.markers['확인 내용']).toBe(true);
    expect(result.markers['Locally 운영 업데이트']).toBe(true);
    expect(result.markers['운영 대시보드 보기']).toBe(true);
    expect(result.markers['확인 필요']).toBe(true);
    expect(html).toContain('Locally 내부 운영 안내 메일');
    expect(html).toContain('background-color:#F8FAFC;border:1px solid #E5E7EB;border-radius:14px');
    expect(html).toContain('font-size:13px');
  });
});
