import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EmailStatusTone } from '@/app/emails/theme/variants';
import { emailStatusStyles } from '@/app/emails/theme/variants';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailRadii,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailTitleBlockProps {
  eyebrow?: string;
  title: string;
  description?: string;
  statusLabel?: string;
  statusTone?: EmailStatusTone;
}

export default function EmailTitleBlock({
  eyebrow,
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
}: EmailTitleBlockProps) {
  const statusStyle = emailStatusStyles[statusTone];

  return (
    <Section style={section}>
      {eyebrow ? <Text style={eyebrowStyle}>{eyebrow}</Text> : null}
      {statusLabel ? (
        <Text
          style={{
            ...statusPill,
            backgroundColor: statusStyle.backgroundColor,
            borderColor: statusStyle.borderColor,
            color: statusStyle.color,
          }}
        >
          {statusLabel}
        </Text>
      ) : null}
      <Heading as="h1" style={titleStyle}>
        {title}
      </Heading>
      {description ? <Text style={descriptionStyle}>{description}</Text> : null}
    </Section>
  );
}

const section = {
  marginBottom: '18px',
};

const eyebrowStyle = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '700',
  letterSpacing: '0.08em',
  margin: '0 0 10px',
  textTransform: 'uppercase' as const,
};

const titleStyle = {
  color: emailColors.strongText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.titleDesktop,
  fontWeight: '700',
  letterSpacing: '-0.02em',
  lineHeight: '1.24',
  margin: '0 0 8px',
};

const descriptionStyle = {
  color: emailColors.defaultText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.body,
  lineHeight: emailTypography.bodyLineHeight,
  margin: '0',
};

const statusPill = {
  border: '1px solid transparent',
  borderRadius: emailRadii.pill,
  display: 'inline-block',
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '600',
  margin: '0 0 10px',
  padding: '5px 9px',
};
