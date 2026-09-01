import { readFileSync } from 'fs';

import { expect, test } from '@playwright/test';

import {
  ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
  detectChatPolicySignals,
} from '@/app/utils/chatPolicySignals';
import { shouldApplyChatPolicySignals } from '@/app/utils/inquiry';
import { getProxyPaymentStatusLabel } from '@/app/utils/proxyBooking';

test.describe('Chat policy signal utility', () => {
  test('detects the conservative default categories only', () => {
    expect(
      detectChatPolicySignals('제 번호는 010-1234-5678 입니다.', {
        activeCategories: ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
      })
    ).toEqual({
      matched: true,
      categories: ['phone'],
    });

    expect(
      detectChatPolicySignals('mail me at locally.policy@example.com', {
        activeCategories: ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
      })
    ).toEqual({
      matched: true,
      categories: ['email'],
    });

    expect(
      detectChatPolicySignals('https://open.kakao.com/o/testpolicy', {
        activeCategories: ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
      })
    ).toEqual({
      matched: true,
      categories: ['external_url'],
    });
  });

  test('keeps bank-account patterns inactive by default', () => {
    expect(
      detectChatPolicySignals('국민 12345678901234 로 부탁드려요.', {
        activeCategories: ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
      })
    ).toEqual({
      matched: false,
      categories: [],
    });
  });

  test('detects only explicit platform ID and ASCII handle combinations', () => {
    const detectedExamples = [
      '카카오톡 ID: locally_123',
      'LINE 아이디는 @tokyo.host',
      'KakaoTalk handle host-2026',
    ];
    const ignoredExamples = [
      '라인에서 봤어요',
      '카카오톡으로 문의했어요',
      'LINE is convenient',
      '카카오톡 ID를 모르겠어요',
      'LINE ID 확인 부탁드려요',
      'outline ID: sample_name',
    ];

    for (const input of detectedExamples) {
      expect(detectChatPolicySignals(input)).toEqual({
        matched: true,
        categories: ['external_handle'],
      });
    }

    for (const input of ignoredExamples) {
      expect(detectChatPolicySignals(input)).toEqual({
        matched: false,
        categories: [],
      });
    }
  });

  test('avoids obvious false positives', () => {
    expect(detectChatPolicySignals('입금 확인 부탁드려요.')).toEqual({
      matched: false,
      categories: [],
    });

    expect(detectChatPolicySignals('카톡은 안 써요.')).toEqual({
      matched: false,
      categories: [],
    });

    expect(detectChatPolicySignals('번호표 받았어요.')).toEqual({
      matched: false,
      categories: [],
    });
  });

  test('excludes all official admin support inquiry types without weakening regular chat policy', () => {
    expect(shouldApplyChatPolicySignals('admin')).toBe(false);
    expect(shouldApplyChatPolicySignals('admin_support')).toBe(false);
    expect(shouldApplyChatPolicySignals('general')).toBe(true);
    expect(shouldApplyChatPolicySignals(null)).toBe(true);
  });

  test('keeps the external-contact help item id while removing pre-booking-only wording in every locale', () => {
    const source = readFileSync('app/help/faqContent.ts', 'utf8');

    expect(source.match(/id: 'no-contact-before-booking'/g)).toHaveLength(4);
    expect(source).toContain("q: '외부 연락처 교환이 왜 제한되나요?'");
    expect(source).toContain("q: 'Why is exchanging external contact information restricted?'");
    expect(source).toContain("q: '外部連絡先の交換が制限されているのはなぜですか？'");
    expect(source).toContain("q: '为什么平台限制交换外部联系方式？'");
    expect(source).not.toContain('예약 확정 전 허용되지 않습니다');
    expect(source).not.toContain('before the booking is confirmed');
  });

  test('keeps proxy payment status wording consistent across channels and methods', () => {
    const baseRequest = {
      payment_channel: 'LOCALLY' as const,
      payment_status: 'WAITING' as const,
      form_data: {},
    };

    expect(getProxyPaymentStatusLabel({
      ...baseRequest,
      form_data: { payment_method: 'card' },
    })).toBe('카드 결제 미완료');
    expect(getProxyPaymentStatusLabel({
      ...baseRequest,
      form_data: { payment_method: 'bank' },
    })).toBe('입금 대기');
    expect(getProxyPaymentStatusLabel({
      ...baseRequest,
      payment_channel: 'NAVER',
    })).toBe('결제 확인 대기');
    expect(getProxyPaymentStatusLabel({
      ...baseRequest,
      payment_status: 'COMPLETED',
    })).toBe('결제 완료');
    expect(getProxyPaymentStatusLabel({
      ...baseRequest,
      payment_status: 'FAILED',
    })).toBe('결제 취소');
    expect(getProxyPaymentStatusLabel({
      ...baseRequest,
      payment_status: 'REFUNDED',
    })).toBe('환불 완료');
  });

  test('retries only the stored proxy card request and quarantines uncertain callbacks', () => {
    const source = readFileSync('app/proxy-bookings/new/page.tsx', 'utf8');
    const retryHandler = source.slice(
      source.indexOf('const handleCardPaymentRetry'),
      source.indexOf('const handleSubmit')
    );

    expect(retryHandler).toContain('runProxyCardPayment(pendingCardPayment)');
    expect(retryHandler).not.toContain("fetch('/api/proxy-bookings'");
    expect(source).toContain("pending.runtime.provider === 'nicepay'");
    expect(source).toContain('?payment=review');
    expect(source).toContain('setPendingCardPayment(pendingPayment)');
  });
});
