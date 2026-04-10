import { Text } from '@react-email/components';
import * as React from 'react';
import EmailBaseLayout from '@/app/emails/components/EmailBaseLayout';
import EmailPrimaryCTA from '@/app/emails/components/EmailPrimaryCTA';
import EmailTitleBlock from '@/app/emails/components/EmailTitleBlock';
import type { NoticeTemplateProps } from '@/app/emails/registry/emailTypes';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailTypography,
} from '@/app/emails/theme/tokens';

export default function NoticeEmail({
  preheader,
  eyebrow,
  title,
  description,
  bodyText,
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

      {bodyText ? <Text style={bodyStyle}>{bodyText}</Text> : null}

      <EmailPrimaryCTA href={ctaUrl}>{ctaLabel}</EmailPrimaryCTA>
    </EmailBaseLayout>
  );
}

const bodyStyle = {
  color: emailColors.defaultText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.body,
  lineHeight: emailTypography.bodyLineHeight,
  margin: '0 0 24px',
  whiteSpace: 'pre-wrap' as const,
};
