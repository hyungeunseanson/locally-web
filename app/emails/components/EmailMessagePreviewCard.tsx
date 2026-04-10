import { Section, Text } from '@react-email/components';
import * as React from 'react';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailRadii,
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
    <Section style={card}>
      {title ? <Text style={titleStyle}>{title}</Text> : null}
      <Text style={messageStyle}>{message}</Text>
    </Section>
  );
}

const card = {
  backgroundColor: '#FFFFFF',
  border: `1px solid ${emailColors.border}`,
  borderRadius: emailRadii.card,
  padding: '16px 18px',
  marginBottom: '20px',
};

const titleStyle = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '700',
  margin: '0 0 8px',
  textTransform: 'uppercase' as const,
};

const messageStyle = {
  color: emailColors.defaultText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.body,
  lineHeight: emailTypography.bodyLineHeight,
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};
