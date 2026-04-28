import type * as React from 'react';
import type { NotificationLocale } from '@/app/utils/notificationLocale';
import type { EmailCopyKey } from '@/app/utils/emailCopy';
import type { EmailFooterVariant, EmailStatusTone } from '@/app/emails/theme/variants';

export type EmailLocale = NotificationLocale;
export type EmailAudience = 'guest' | 'host' | 'admin';
export type EmailTemplateId =
  | 'booking.confirmed'
  | 'booking.cancelled'
  | 'booking.bank_confirmed_host'
  | 'inquiry.new_message'
  | 'host_application.status'
  | 'review.new_host'
  | 'service.payment_confirmed'
  | 'service.request_new_host'
  | 'service.host_selected'
  | 'notice.copy'
  | 'notice.custom';
export type EmailTransportPolicy = 'transactional' | 'opsAdmin';

export const DEFAULT_EMAIL_LOCALE: EmailLocale = 'ko';

export type EmailRenderResult = {
  subject: string;
  preheader: string;
  html: string;
  text: string;
};

export type EmailRecipient = {
  userId?: string | null;
  email?: string | null;
};

export type EmailSummaryItem = {
  label: string;
  value: string;
  emphasis?: boolean;
};

type HostFaultReviewType = 'host_unavailable' | 'minimum_participants_unmet';

export type EmailPayloadMap = {
  'booking.confirmed': {
    experienceTitle: string;
    bookingDate: string;
    bookingTime?: string;
    partySize: number;
    amount: number;
    ctaUrl: string;
    recipientName?: string;
    guestName?: string;
  };
  'booking.cancelled': {
    experienceTitle: string;
    reason?: string;
    refundAmount?: number;
    ctaUrl: string;
    recipientName?: string;
    variant: 'standard' | 'admin_force' | 'host_fault';
    reviewType?: HostFaultReviewType;
  };
  'booking.bank_confirmed_host': {
    experienceTitle: string;
    ctaUrl: string;
  };
  'inquiry.new_message': {
    actorName: string;
    threadTitle?: string;
    messagePreview: string;
    ctaUrl: string;
  };
  'host_application.status': {
    status: 'approved' | 'revision' | 'rejected';
    note?: string;
    ctaUrl: string;
  };
  'service.payment_confirmed': {
    requestTitle: string;
    amount?: number;
    ctaUrl: string;
    recipientName?: string;
  };
  'review.new_host': {
    experienceTitle: string;
    ctaUrl: string;
  };
  'service.request_new_host': {
    requestTitle: string;
    requestCity: string;
    durationHours: number;
    guestCount: number;
    ctaUrl: string;
  };
  'service.host_selected': {
    requestTitle: string;
    ctaUrl: string;
  };
  'notice.copy': {
    copyKey: EmailCopyKey;
    copyParams?: Record<string, unknown>;
    ctaUrl: string;
    preheader?: string;
    eyebrow?: string;
    footerVariant?: EmailFooterVariant;
    statusLabel?: string;
    statusTone?: EmailStatusTone;
    helpLinkHref?: string;
  };
  'notice.custom': {
    subject: string;
    title: string;
    message: string;
    ctaLabel: string;
    ctaUrl: string;
    preheader?: string;
    eyebrow?: string;
    footerVariant?: EmailFooterVariant;
    statusLabel?: string;
    statusTone?: EmailStatusTone;
    helpPrompt?: string;
    helpLinkLabel?: string;
    helpLinkHref?: string;
  };
};

export type EmailSendRequest<T extends EmailTemplateId = EmailTemplateId> = {
  templateId: T;
  audience: EmailAudience;
  // Locale fallback priority: explicit locale -> recipient preferred_locale -> ko.
  locale?: EmailLocale | null;
  recipient: EmailRecipient;
  payload: EmailPayloadMap[T];
  transportPolicy?: EmailTransportPolicy;
};

type BaseTemplateProps = {
  locale: EmailLocale;
  subject: string;
  preheader: string;
  title: string;
  description?: string;
  eyebrow?: string;
  statusLabel?: string;
  statusTone?: EmailStatusTone;
  ctaLabel: string;
  ctaUrl: string;
  summaryItems?: EmailSummaryItem[];
  summaryTitle?: string;
  helperText?: string;
  helpPrompt?: string;
  helpLinkLabel?: string;
  helpLinkHref?: string;
  footerVariant?: EmailFooterVariant;
};

export type BookingConfirmedTemplateProps = BaseTemplateProps;
export type BookingCancelledTemplateProps = BaseTemplateProps;
export type InquiryNewMessageTemplateProps = BaseTemplateProps & {
  messagePreview: string;
  messagePreviewTitle?: string;
};
export type HostApplicationStatusTemplateProps = BaseTemplateProps & {
  note?: string;
  noteTitle?: string;
};
export type ServicePaymentConfirmedTemplateProps = BaseTemplateProps;
export type NoticeTemplateProps = BaseTemplateProps & {
  bodyText?: string;
  bodyCardTitle?: string;
};

export type EmailTemplatePropsMap = {
  'booking.confirmed': BookingConfirmedTemplateProps;
  'booking.cancelled': BookingCancelledTemplateProps;
  'booking.bank_confirmed_host': BookingConfirmedTemplateProps;
  'inquiry.new_message': InquiryNewMessageTemplateProps;
  'host_application.status': HostApplicationStatusTemplateProps;
  'review.new_host': BookingConfirmedTemplateProps;
  'service.payment_confirmed': ServicePaymentConfirmedTemplateProps;
  'service.request_new_host': ServicePaymentConfirmedTemplateProps;
  'service.host_selected': ServicePaymentConfirmedTemplateProps;
  'notice.copy': NoticeTemplateProps;
  'notice.custom': NoticeTemplateProps;
};

export type EmailBuilderContext<T extends EmailTemplateId> = {
  audience: EmailAudience;
  locale: EmailLocale;
  payload: EmailPayloadMap[T];
};

export type EmailTemplateRegistration<T extends EmailTemplateId> = {
  component: React.ComponentType<EmailTemplatePropsMap[T]>;
  buildProps: (
    context: EmailBuilderContext<T>
  ) => EmailTemplatePropsMap[T];
};
