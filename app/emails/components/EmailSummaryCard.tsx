import { Section, Text } from '@react-email/components';
import * as React from 'react';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailRadii,
  emailShadows,
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
    <Section className="locally-email-panel" style={card}>
      {title ? <Text style={titleStyle}>{title}</Text> : null}
      {children}
    </Section>
  );
}

const card = {
  backgroundColor: emailColors.glassSurface,
  border: `1px solid ${emailColors.glassBorder}`,
  borderRadius: emailRadii.card,
  boxShadow: emailShadows.panel,
  padding: '16px',
  marginBottom: '18px',
};

const titleStyle = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '600',
  letterSpacing: '0.01em',
  lineHeight: '1.4',
  margin: '0 0 10px',
};
