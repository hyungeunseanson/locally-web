import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailMessagePreviewCard from '@/app/emails/components/EmailMessagePreviewCard';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { HostApplicationStatusTemplateProps } from '@/app/emails/registry/emailTypes';

export default function HostApplicationStatusEmail({
  locale,
  preheader,
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone,
  note,
  noteTitle,
  ctaLabel,
  ctaUrl,
  helpPrompt,
  helpLinkLabel,
  helpLinkHref,
  footerVariant,
}: HostApplicationStatusTemplateProps) {
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

      {note ? (
        <EmailMessagePreviewCard title={noteTitle} message={note} />
      ) : null}

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}
