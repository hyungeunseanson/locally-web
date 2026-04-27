import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailKVRow from '@/app/emails/components/EmailKVRow';
import EmailMessagePreviewCard from '@/app/emails/components/EmailMessagePreviewCard';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailSummaryCard from '@/app/emails/components/EmailSummaryCard';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { InquiryNewMessageTemplateProps } from '@/app/emails/registry/emailTypes';

export default function InquiryNewMessageEmail({
  locale,
  preheader,
  eyebrow,
  title,
  description,
  summaryItems = [],
  summaryTitle,
  messagePreview,
  messagePreviewTitle,
  ctaLabel,
  ctaUrl,
  helpPrompt,
  helpLinkLabel,
  helpLinkHref,
  footerVariant,
}: InquiryNewMessageTemplateProps) {
  return (
    <EmailBaseLayout
      locale={locale}
      previewText={preheader}
      helpPrompt={helpPrompt}
      helpLinkLabel={helpLinkLabel}
      helpLinkHref={helpLinkHref}
      footerVariant={footerVariant}
    >
      <EmailTitleBlock eyebrow={eyebrow} title={title} description={description} />

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

      <EmailMessagePreviewCard title={messagePreviewTitle} message={messagePreview} />

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}
