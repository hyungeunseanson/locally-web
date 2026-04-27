import { Heading, Section, Text } from '@react-email/components';
import * as React from 'react';
import type { EmailStatusTone } from '@/app/emails/theme/variants';
import { emailStatusStyles } from '@/app/emails/theme/variants';
import {
  emailColors,
  EMAIL_FONT_STACK,
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
        <Text style={{ ...statusRow, color: statusStyle.color }}>
          <span style={{ ...statusDot, backgroundColor: statusStyle.color }} />
          {statusLabel}
        </Text>
      ) : null}
      <Heading as="h1" className="locally-email-title" style={titleStyle}>
        {title}
      </Heading>
      {description ? <Text style={descriptionStyle}>{description}</Text> : null}
    </Section>
  );
}

const section = {
  marginBottom: '20px',
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
  fontSize: emailTypography.titleMobile,
  fontWeight: '800',
  letterSpacing: '0',
  lineHeight: '1.22',
  margin: '0 0 10px',
};

const descriptionStyle = {
  color: emailColors.defaultText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.body,
  lineHeight: emailTypography.bodyLineHeight,
  margin: '0',
  textAlign: 'left' as const,
};

const statusRow = {
  display: 'inline-block',
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 10px',
  padding: '0',
};

const statusDot = {
  borderRadius: '999px',
  display: 'inline-block',
  height: '6px',
  marginRight: '7px',
  verticalAlign: '1px',
  width: '6px',
};
