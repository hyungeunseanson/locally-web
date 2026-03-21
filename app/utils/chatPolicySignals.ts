export type ChatPolicySignalCategory =
  | 'phone'
  | 'email'
  | 'external_url'
  | 'external_handle'
  | 'bank_account';

export type ChatPolicySignals = {
  matched: boolean;
  categories: ChatPolicySignalCategory[];
};

type DetectChatPolicySignalsOptions = {
  activeCategories?: readonly ChatPolicySignalCategory[];
};

export const ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES = [
  'phone',
  'email',
  'external_url',
] as const satisfies readonly ChatPolicySignalCategory[];

export const CHAT_POLICY_SIGNAL_LABELS: Record<ChatPolicySignalCategory, string> = {
  phone: '전화번호',
  email: '이메일',
  external_url: '외부 링크',
  external_handle: '외부 연락 ID',
  bank_account: '계좌 정보',
};

const PHONE_REGEX =
  /(?:\+?82[-.\s()]*)?1[016789](?:[-.\s()]*)\d{3,4}(?:[-.\s()]*)\d{4}\b|\b01[016789](?:[-.\s()]*)\d{3,4}(?:[-.\s()]*)\d{4}\b/i;
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const EXTERNAL_URL_REGEX =
  /(?:https?:\/\/|www\.)?[^\s]*?(?:open\.kakao\.com|t\.me|telegram\.me|line\.me|wa\.me|discord\.gg|instagram\.com)[^\s]*/i;
const EXTERNAL_HANDLE_REGEX =
  /(?:카톡|카카오톡|텔레그램|텔레|라인|위챗|wechat|discord|인스타|instagram|insta|오픈채팅)\s*(?:id|아이디|handle)?\s*[:\-]?\s*@?[A-Z0-9._-]{4,}/i;
const BANK_CONTEXT_REGEX =
  /(?:계좌|입금|송금|예금주|국민|신한|농협|우리|하나|기업|카카오뱅크|토스뱅크|새마을|우체국|수협|부산|대구|광주|전북|경남|SC제일|씨티).{0,12}\b\d[\d\s-]{6,22}\b/i;

function hasPhoneSignal(input: string) {
  return PHONE_REGEX.test(input);
}

function hasEmailSignal(input: string) {
  return EMAIL_REGEX.test(input);
}

function hasExternalUrlSignal(input: string) {
  return EXTERNAL_URL_REGEX.test(input);
}

function hasExternalHandleSignal(input: string) {
  return EXTERNAL_HANDLE_REGEX.test(input);
}

function hasBankAccountSignal(input: string) {
  return BANK_CONTEXT_REGEX.test(input);
}

export function detectChatPolicySignals(
  input: string,
  options?: DetectChatPolicySignalsOptions
): ChatPolicySignals {
  const text = input.trim();
  if (!text) {
    return { matched: false, categories: [] };
  }

  const activeCategories = new Set(
    options?.activeCategories ?? ACTIVE_CHAT_POLICY_SIGNAL_CATEGORIES
  );

  const categories = new Set<ChatPolicySignalCategory>();

  if (activeCategories.has('phone') && hasPhoneSignal(text)) {
    categories.add('phone');
  }

  if (activeCategories.has('email') && hasEmailSignal(text)) {
    categories.add('email');
  }

  if (activeCategories.has('external_url') && hasExternalUrlSignal(text)) {
    categories.add('external_url');
  }

  if (activeCategories.has('external_handle') && hasExternalHandleSignal(text)) {
    categories.add('external_handle');
  }

  if (activeCategories.has('bank_account') && hasBankAccountSignal(text)) {
    categories.add('bank_account');
  }

  return {
    matched: categories.size > 0,
    categories: Array.from(categories),
  };
}
