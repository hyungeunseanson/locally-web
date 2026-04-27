import { Section, Text } from '@react-email/components';
import * as React from 'react';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailRadii,
  emailShadows,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailMessagePreviewCardProps {
  title?: string;
  message: string;
}

export default function EmailMessagePreviewCard({
  title,
  message,
}: EmailMessagePreviewCardProps) {
  return (
    <Section className="locally-email-panel" style={card}>
      {title ? <Text style={titleStyle}>{title}</Text> : null}
      <Text style={messageStyle}>{message}</Text>
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
  lineHeight: '1.4',
  margin: '0 0 8px',
  textAlign: 'left' as const,
};

const messageStyle = {
  color: emailColors.defaultText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.body,
  lineHeight: emailTypography.bodyLineHeight,
  margin: '0',
  textAlign: 'left' as const,
  whiteSpace: 'pre-line' as const,
};
