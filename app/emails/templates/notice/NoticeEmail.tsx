import { Text } from '@react-email/components';
import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailSummaryCard from '@/app/emails/components/EmailSummaryCard';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { NoticeTemplateProps } from '@/app/emails/registry/emailTypes';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailTypography,
} from '@/app/emails/theme/tokens';

export default function NoticeEmail({
  locale,
  preheader,
  eyebrow,
  title,
  description,
  bodyText,
  bodyCardTitle,
  statusLabel,
  statusTone,
  ctaLabel,
  ctaUrl,
  helpPrompt,
  helpLinkLabel,
  helpLinkHref,
  footerVariant,
}: NoticeTemplateProps) {
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

      {bodyText ? (
        <EmailSummaryCard title={bodyCardTitle}>
          <Text style={bodyStyle}>{bodyText}</Text>
        </EmailSummaryCard>
      ) : null}

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}

const bodyStyle = {
  color: emailColors.defaultText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.body,
  lineHeight: emailTypography.bodyLineHeight,
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};
