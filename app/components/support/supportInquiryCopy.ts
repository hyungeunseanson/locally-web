import type { Locale } from '@/app/context/LanguageContext';

export type SupportInquiryCopy = {
  reportButtonLabel: string;
  noAdmin: string;
  submitSuccess: string;
  submitFailPrefix: string;
  profileSyncDelay: string;
  unknownError: string;
  closeSr: string;
  modalTitle: string;
  modalDesc: string;
  modalPlaceholder: string;
  modalSubmitting: string;
  modalSubmit: string;
  supportEmailNote: string;
};

const SUPPORT_INQUIRY_COPY: Record<Locale, SupportInquiryCopy> = {
  ko: {
    reportButtonLabel: '오류·불편 신고',
    noAdmin: '현재 상담 가능한 관리자가 없습니다.',
    submitSuccess: '문의가 접수되었습니다.',
    submitFailPrefix: '문의 접수 실패: ',
    profileSyncDelay: '계정 동기화에 지연이 발생했습니다. 5초 뒤 다시 시도해 주시기 바랍니다.',
    unknownError: '알 수 없는 오류',
    closeSr: '닫기',
    modalTitle: '1:1 문의하기',
    modalDesc: '관리자가 확인 후 메시지함으로 답변드립니다.',
    modalPlaceholder: '문의하실 내용을 입력해주세요.',
    modalSubmitting: '전송 중...',
    modalSubmit: '문의 접수',
    supportEmailNote: '공식 고객지원 메일',
  },
  en: {
    reportButtonLabel: 'Report a problem',
    noAdmin: 'There is no available support manager right now.',
    submitSuccess: 'Your inquiry has been received.',
    submitFailPrefix: 'Failed to submit inquiry: ',
    profileSyncDelay: 'Account sync is delayed. Please try again in 5 seconds.',
    unknownError: 'Unknown error',
    closeSr: 'Close',
    modalTitle: 'Contact Support',
    modalDesc: 'Our team will review it and reply in your inbox.',
    modalPlaceholder: 'Please enter your inquiry.',
    modalSubmitting: 'Sending...',
    modalSubmit: 'Send inquiry',
    supportEmailNote: 'Official support inbox',
  },
  ja: {
    reportButtonLabel: '不具合を報告',
    noAdmin: '現在対応可能なサポート担当者がいません。',
    submitSuccess: 'お問い合わせを受け付けました。',
    submitFailPrefix: 'お問い合わせ受付失敗: ',
    profileSyncDelay: 'アカウント同期が遅れています。5秒後にもう一度お試しください。',
    unknownError: '不明なエラー',
    closeSr: '閉じる',
    modalTitle: '1:1 お問い合わせ',
    modalDesc: '担当者が確認後、メッセージボックスで返信します。',
    modalPlaceholder: 'お問い合わせ内容を入力してください。',
    modalSubmitting: '送信中...',
    modalSubmit: 'お問い合わせ送信',
    supportEmailNote: '公式サポート窓口',
  },
  zh: {
    reportButtonLabel: '报告问题',
    noAdmin: '当前没有可处理咨询的客服人员。',
    submitSuccess: '咨询已提交。',
    submitFailPrefix: '咨询提交失败：',
    profileSyncDelay: '账号同步稍有延迟，请在 5 秒后重试。',
    unknownError: '未知错误',
    closeSr: '关闭',
    modalTitle: '1:1 咨询',
    modalDesc: '管理员确认后会在消息箱中回复您。',
    modalPlaceholder: '请输入咨询内容。',
    modalSubmitting: '发送中...',
    modalSubmit: '提交咨询',
    supportEmailNote: '官方客服邮箱',
  },
};

export function getSupportInquiryCopy(locale: Locale): SupportInquiryCopy {
  return SUPPORT_INQUIRY_COPY[locale] || SUPPORT_INQUIRY_COPY.ko;
}
