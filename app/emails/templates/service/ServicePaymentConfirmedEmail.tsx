import { Section } from '@react-email/components';
import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailKVRow from '@/app/emails/components/EmailKVRow';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailSummaryCard from '@/app/emails/components/EmailSummaryCard';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { ServicePaymentConfirmedTemplateProps } from '@/app/emails/registry/emailTypes';

export default function ServicePaymentConfirmedEmail({
  preheader,
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone,
  summaryItems = [],
  ctaLabel,
  ctaUrl,
  helpPrompt,
  helpLinkLabel,
  helpLinkHref,
  footerVariant,
}: ServicePaymentConfirmedTemplateProps) {
  return (
    <EmailBaseLayout
      previewText={preheader}
      eyebrow={eyebrow}
      helpPrompt={helpPrompt}
      helpLinkLabel={helpLinkLabel}
      helpLinkHref={helpLinkHref}
      footerVariant={footerVariant}
    >
      <EmailTitleBlock
        title={title}
        description={description}
        statusLabel={statusLabel}
        statusTone={statusTone}
      />

      {summaryItems.length > 0 ? (
        <EmailSummaryCard title="Summary">
          {summaryItems.map((item, index) => (
            <Section
              key={`${item.label}-${index}`}
              style={index === summaryItems.length - 1 ? lastRow : undefined}
            >
              <EmailKVRow
                label={item.label}
                value={item.value}
                emphasis={item.emphasis}
              />
            </Section>
          ))}
        </EmailSummaryCard>
      ) : null}

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}

const lastRow = {
  borderBottom: 'none',
};
