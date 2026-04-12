import { Section, Text } from '@react-email/components';
import * as React from 'react';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailRadii,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailSummaryCardProps {
  title?: string;
  children: React.ReactNode;
}

export default function EmailSummaryCard({
  title,
  children,
}: EmailSummaryCardProps) {
  return (
    <Section style={card}>
      {title ? <Text style={titleStyle}>{title}</Text> : null}
      {children}
    </Section>
  );
}

const card = {
  backgroundColor: emailColors.subtle,
  border: `1px solid ${emailColors.border}`,
  borderRadius: emailRadii.card,
  padding: '14px 14px 2px',
  marginBottom: '16px',
};

const titleStyle = {
  color: emailColors.strongText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '700',
  letterSpacing: '0',
  margin: '0 0 10px',
};
