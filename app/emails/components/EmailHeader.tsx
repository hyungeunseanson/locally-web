import { Section, Text } from '@react-email/components';
import * as React from 'react';
import {
  emailColors,
  EMAIL_FONT_STACK,
} from '@/app/emails/theme/tokens';

export default function EmailHeader() {
  return (
    <Section className="locally-email-header" style={header}>
      <Text className="locally-email-wordmark" style={wordmark}>Locally</Text>
    </Section>
  );
}

const header = {
  backgroundColor: emailColors.surface,
  padding: '24px 20px 0',
  textAlign: 'left' as const,
};

const wordmark = {
  color: emailColors.strongText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: '20px',
  fontWeight: '800',
  letterSpacing: '0',
  lineHeight: '1',
  margin: '0',
};
