import { expect, test } from '@playwright/test';

import {
  ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
  detectChatPolicySignals,
} from '@/app/utils/chatPolicySignals';

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

  test('keeps bank-account and handle patterns inactive by default', () => {
    expect(
      detectChatPolicySignals('카톡 abc1234 로 연락 주세요.', {
        activeCategories: ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
      })
    ).toEqual({
      matched: false,
      categories: [],
    });

    expect(
      detectChatPolicySignals('국민 12345678901234 로 부탁드려요.', {
        activeCategories: ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES,
      })
    ).toEqual({
      matched: false,
      categories: [],
    });
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
});
