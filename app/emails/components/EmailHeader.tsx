import { Img, Section, Text } from '@react-email/components';
import * as React from 'react';
import { getSiteUrl } from '@/app/utils/siteUrl';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailRadii,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailHeaderProps {
  eyebrow?: string;
}

export default function EmailHeader({ eyebrow }: EmailHeaderProps) {
  return (
    <Section style={header}>
      <Img
        src={`${getSiteUrl()}/images/logo-black-transparent.png`}
        alt="Locally"
        width="100"
        height="36"
        style={logo}
      />
      {eyebrow ? <Text style={eyebrowText}>{eyebrow}</Text> : null}
    </Section>
  );
}

const header = {
  backgroundColor: emailColors.surface,
  padding: '24px 32px 0',
  textAlign: 'center' as const,
};

const logo = {
  objectFit: 'contain' as const,
  margin: '0 auto',
};

const eyebrowText = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '600',
  letterSpacing: '0.08em',
  margin: '14px auto 0',
  textTransform: 'uppercase' as const,
  backgroundColor: emailColors.subtle,
  border: `1px solid ${emailColors.border}`,
  borderRadius: emailRadii.pill,
  display: 'inline-block',
  padding: '6px 10px',
};
