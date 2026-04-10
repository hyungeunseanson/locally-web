import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailMessagePreviewCard from '@/app/emails/components/EmailMessagePreviewCard';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { HostApplicationStatusTemplateProps } from '@/app/emails/registry/emailTypes';

export default function HostApplicationStatusEmail({
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

      {note ? (
        <EmailMessagePreviewCard title={noteTitle} message={note} />
      ) : null}

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}
