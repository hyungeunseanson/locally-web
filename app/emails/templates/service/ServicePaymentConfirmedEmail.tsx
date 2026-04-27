import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailKVRow from '@/app/emails/components/EmailKVRow';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailSummaryCard from '@/app/emails/components/EmailSummaryCard';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { ServicePaymentConfirmedTemplateProps } from '@/app/emails/registry/emailTypes';

export default function ServicePaymentConfirmedEmail({
  locale,
  preheader,
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone,
  summaryItems = [],
  summaryTitle,
  ctaLabel,
  ctaUrl,
  helpPrompt,
  helpLinkLabel,
  helpLinkHref,
  footerVariant,
}: ServicePaymentConfirmedTemplateProps) {
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

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}
