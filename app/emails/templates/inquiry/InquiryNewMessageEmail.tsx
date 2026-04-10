import { Section } from '@react-email/components';
import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailKVRow from '@/app/emails/components/EmailKVRow';
import EmailMessagePreviewCard from '@/app/emails/components/EmailMessagePreviewCard';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailSummaryCard from '@/app/emails/components/EmailSummaryCard';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { InquiryNewMessageTemplateProps } from '@/app/emails/registry/emailTypes';

export default function InquiryNewMessageEmail({
  preheader,
  eyebrow,
  title,
  description,
  summaryItems = [],
  messagePreview,
  ctaLabel,
  ctaUrl,
  helpPrompt,
  helpLinkLabel,
  helpLinkHref,
  footerVariant,
}: InquiryNewMessageTemplateProps) {
  return (
    <EmailBaseLayout
      previewText={preheader}
      eyebrow={eyebrow}
      helpPrompt={helpPrompt}
      helpLinkLabel={helpLinkLabel}
      helpLinkHref={helpLinkHref}
      footerVariant={footerVariant}
    >
      <EmailTitleBlock title={title} description={description} />

      {summaryItems.length > 0 ? (
        <EmailSummaryCard title="Conversation">
          {summaryItems.map((item, index) => (
            <Section key={`${item.label}-${index}`} style={index === summaryItems.length - 1 ? lastRow : undefined}>
              <EmailKVRow
                label={item.label}
                value={item.value}
                emphasis={item.emphasis}
              />
            </Section>
          ))}
        </EmailSummaryCard>
      ) : null}

      <EmailMessagePreviewCard title="Message preview" message={messagePreview} />

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}

const lastRow = {
  borderBottom: 'none',
};
