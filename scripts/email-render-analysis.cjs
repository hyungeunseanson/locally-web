const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const { registerHook } = require('../node_modules/next/dist/build/next-config-ts/require-hook.js');
const { transformSync } = require('../node_modules/next/dist/build/swc');

const cwd = path.resolve(__dirname, '..');
process.chdir(cwd);

registerHook({
  module: { type: 'commonjs' },
  jsc: {
    parser: { syntax: 'typescript', tsx: true },
    transform: { react: { runtime: 'automatic' } },
    target: 'es2020',
  },
});

const oldTsxHook = require.extensions['.tsx'] || require.extensions['.js'];
require.extensions['.tsx'] = function registerTsx(mod, filename) {
  const _compile = mod._compile;
  mod._compile = function compileTsx(code, compiledFilename) {
    const swc = transformSync(code, {
      module: { type: 'commonjs' },
      jsc: {
        parser: { syntax: 'typescript', tsx: true },
        transform: { react: { runtime: 'automatic' } },
        target: 'es2020',
      },
    });
    return _compile.call(this, swc.code, compiledFilename);
  };
  return oldTsxHook(mod, filename);
};

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    request = path.join(cwd, request.slice(2));
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'server-only') {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { renderEmailTemplate } = require(path.join(cwd, 'app/emails/render/renderEmailTemplate.ts'));

function extractAccentLine(html) {
  return /height:\s*2px;[^"]*line-height:\s*2px/i.test(html);
}

function extractMobileFirstCta(html) {
  return /background-color:\s*#111111/i.test(html)
    && /min-height:\s*48px/i.test(html)
    && /width:\s*100%/i.test(html);
}

async function renderCase(name, request, markers = []) {
  const rendered = await renderEmailTemplate(request);
  const outputPath = path.join('/tmp', `${name}.html`);
  fs.writeFileSync(outputPath, rendered.html, 'utf8');

  const markerResults = Object.fromEntries(
    markers.map((marker) => [marker, rendered.html.includes(marker)])
  );

  return {
    name,
    outputPath,
    subject: rendered.subject,
    preheader: rendered.preheader,
    htmlLength: rendered.html.length,
    accentLine2px: extractAccentLine(rendered.html),
    mobileFirstCta: extractMobileFirstCta(rendered.html),
    markers: markerResults,
  };
}

(async () => {
  const results = [];

  results.push(await renderCase(
    'email_booking_confirmed_after',
    {
      templateId: 'booking.confirmed',
      audience: 'host',
      locale: 'ko',
      recipient: {},
      payload: {
        experienceTitle: '도쿄 야경 투어',
        bookingDate: '2026-04-20',
        bookingTime: '19:00',
        partySize: 2,
        amount: 58000,
        ctaUrl: '/host/dashboard',
        recipientName: '민지',
        guestName: 'Sora',
      },
    },
    ['예약 정보', '예약 접수', '새 예약이 접수되었습니다', '예약 상세 확인하기']
  ));

  results.push(await renderCase(
    'email_booking_cancelled_after',
    {
      templateId: 'booking.cancelled',
      audience: 'guest',
      locale: 'ko',
      recipient: {},
      payload: {
        experienceTitle: '제주 야시장 워크',
        reason: '운영 사정',
        refundAmount: 25000,
        ctaUrl: '/trips',
        variant: 'standard',
      },
    },
    ['예약 정보', '예약 취소', '예약이 취소되었습니다', '내 여행 보기']
  ));

  results.push(await renderCase(
    'email_inquiry_new_message_after',
    {
      templateId: 'inquiry.new_message',
      audience: 'guest',
      locale: 'en',
      recipient: {},
      payload: {
        actorName: 'Locally Support',
        threadTitle: 'Airport pickup request',
        messagePreview: 'We checked your request and shared the pickup details.',
        ctaUrl: '/inbox',
      },
    },
    ['Conversation details', 'Latest message', 'Check message']
  ));

  results.push(await renderCase(
    'email_service_payment_confirmed_after',
    {
      templateId: 'service.payment_confirmed',
      audience: 'guest',
      locale: 'ja',
      recipient: {},
      payload: {
        requestTitle: '東京通訳サポート',
        amount: 98000,
        ctaUrl: '/services/req-1',
      },
    },
    ['依頼情報', '決済完了', '依頼を見る']
  ));

  results.push(await renderCase(
    'email_review_new_host_after',
    {
      templateId: 'review.new_host',
      audience: 'host',
      locale: 'ko',
      recipient: {},
      payload: {
        experienceTitle: '도쿄 야경 투어',
        ctaUrl: '/host/dashboard?tab=reviews',
      },
    },
    ['알림 정보', '후기 알림', '새 후기가 등록되었습니다', '후기 확인하기']
  ));

  results.push(await renderCase(
    'email_booking_bank_confirmed_host_after',
    {
      templateId: 'booking.bank_confirmed_host',
      audience: 'host',
      locale: 'ko',
      recipient: {},
      payload: {
        experienceTitle: '도쿄 야경 투어',
        ctaUrl: '/host/dashboard',
      },
    },
    ['예약 정보', '입금 확인', '입금 확인 완료', '호스트 대시보드 열기']
  ));

  results.push(await renderCase(
    'email_service_request_new_host_after',
    {
      templateId: 'service.request_new_host',
      audience: 'host',
      locale: 'ko',
      recipient: {},
      payload: {
        requestTitle: '도쿄 통역 서포트',
        requestCity: '도쿄',
        durationHours: 4,
        guestCount: 2,
        ctaUrl: '/services/req-2',
      },
    },
    ['요청 정보', '새 의뢰', '새로운 맞춤 서비스 의뢰가 도착했습니다', '의뢰 확인하기']
  ));

  results.push(await renderCase(
    'email_service_host_selected_after',
    {
      templateId: 'service.host_selected',
      audience: 'host',
      locale: 'ko',
      recipient: {},
      payload: {
        requestTitle: '도쿄 통역 서포트',
        ctaUrl: '/services/req-2',
      },
    },
    ['요청 정보', '선택됨', '고객에게 선택되었습니다', '의뢰 확인하기']
  ));

  results.push(await renderCase(
    'email_notice_custom_after',
    {
      templateId: 'notice.custom',
      audience: 'admin',
      locale: 'ko',
      recipient: {},
      payload: {
        subject: '[Locally Admin] 운영팀 확인이 필요한 알림입니다',
        title: '운영팀 확인이 필요한 알림입니다',
        message: '정산 지연 가능성이 있는 예약이 감지되었습니다.\n담당자 확인이 필요합니다.',
        ctaLabel: '운영 대시보드 보기',
        ctaUrl: '/admin/dashboard?tab=ALERTS',
        footerVariant: 'opsAdmin',
        statusLabel: '확인 필요',
        statusTone: 'warning',
      },
    },
    ['확인 내용', 'Locally 운영 업데이트', '운영 대시보드 보기', '확인 필요']
  ));

  console.log(JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
