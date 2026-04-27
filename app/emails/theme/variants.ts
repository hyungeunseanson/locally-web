import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import { emailColors } from './tokens';

export type EmailStatusTone = 'neutral' | 'success' | 'warning' | 'danger';
export type EmailFooterVariant = 'transactional' | 'opsAdmin';

export const defaultHelpLinkHref = buildAbsoluteUrl('/about');

export const defaultHelpCopyByLocale = {
  ko: {
    helpPrompt: '궁금하신 점이 있으신가요?',
    helpLinkLabel: '도움 센터 보기',
    helpLinkHref: defaultHelpLinkHref,
  },
  en: {
    helpPrompt: 'Need anything else?',
    helpLinkLabel: 'Visit the help center',
    helpLinkHref: defaultHelpLinkHref,
  },
  ja: {
    helpPrompt: 'ご不明な点はありますか？',
    helpLinkLabel: 'ヘルプセンターを見る',
    helpLinkHref: defaultHelpLinkHref,
  },
  zh: {
    helpPrompt: '还有其他问题吗？',
    helpLinkLabel: '访问帮助中心',
    helpLinkHref: defaultHelpLinkHref,
  },
} as const;

export const emailStatusStyles: Record<
  EmailStatusTone,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  neutral: {
    backgroundColor: emailColors.subtle,
    color: emailColors.defaultText,
    borderColor: emailColors.border,
  },
  success: {
    backgroundColor: emailColors.softAccent,
    color: emailColors.brandPrimary,
    borderColor: '#FFD2DC',
  },
  warning: {
    backgroundColor: emailColors.warningBg,
    color: emailColors.warningText,
    borderColor: '#FDE68A',
  },
  danger: {
    backgroundColor: emailColors.dangerBg,
    color: emailColors.dangerText,
    borderColor: '#FECACA',
  },
};
