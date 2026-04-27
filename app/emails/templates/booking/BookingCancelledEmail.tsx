import { Text } from '@react-email/components';
import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailKVRow from '@/app/emails/components/EmailKVRow';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailSummaryCard from '@/app/emails/components/EmailSummaryCard';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { BookingCancelledTemplateProps } from '@/app/emails/registry/emailTypes';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailTypography,
} from '@/app/emails/theme/tokens';

export default function BookingCancelledEmail({
  locale,
  preheader,
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone,
  summaryItems = [],
  summaryTitle,
  helperText,
  ctaLabel,
  ctaUrl,
  helpPrompt,
  helpLinkLabel,
  helpLinkHref,
  footerVariant,
}: BookingCancelledTemplateProps) {
  return (
    <EmailBaseLayout
      locale={locale}
      previewText={preheader}
      helpPrompt={helpPrompt}
      helpLinkLabel={helpLinkLabel}
      helpLinkHref={helpLinkHref}
      footerVariant={footerVariant}
    >
      <EmailTitleBlock
        eyebrow={eyebrow}
        title={title}
        description={description}
        statusLabel={statusLabel}
        statusTone={statusTone}
      />

      {summaryItems.length > 0 ? (
        <EmailSummaryCard title={summaryTitle}>
          {summaryItems.map((item, index) => (
            <EmailKVRow
              key={`${item.label}-${index}`}
              label={item.label}
              value={item.value}
              emphasis={item.emphasis}
              featured={index === 0}
              isLast={index === summaryItems.length - 1}
            />
          ))}
        </EmailSummaryCard>
      ) : null}

      {helperText ? <Text style={helperStyle}>{helperText}</Text> : null}

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}

const helperStyle = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.body,
  lineHeight: '1.68',
  margin: '0 0 16px',
  textAlign: 'left' as const,
};
