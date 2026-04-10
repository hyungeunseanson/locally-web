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
  title: string;
  description?: string;
  statusLabel?: string;
  statusTone?: EmailStatusTone;
}

export default function EmailTitleBlock({
  title,
  description,
  statusLabel,
  statusTone = 'neutral',
}: EmailTitleBlockProps) {
  const statusStyle = emailStatusStyles[statusTone];

  return (
    <Section style={section}>
      <Heading as="h1" style={titleStyle}>
        {title}
      </Heading>
      {description ? <Text style={descriptionStyle}>{description}</Text> : null}
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
    </Section>
  );
}

const section = {
  marginBottom: '24px',
};

const titleStyle = {
  color: emailColors.strongText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.titleDesktop,
  fontWeight: '700',
  letterSpacing: '-0.02em',
  lineHeight: '1.2',
  margin: '0 0 10px',
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
  margin: '14px 0 0',
  padding: '6px 10px',
};
