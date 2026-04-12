import { Section, Text } from '@react-email/components';
import * as React from 'react';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailKVRowProps {
  label: string;
  value: string;
  emphasis?: boolean;
  isLast?: boolean;
}

export default function EmailKVRow({
  label,
  value,
  emphasis = false,
  isLast = false,
}: EmailKVRowProps) {
  return (
    <Section style={{ ...row, ...(isLast ? lastRow : null) }}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={emphasis ? valueStrongStyle : valueStyle}>{value}</Text>
    </Section>
  );
}

const row = {
  borderBottom: `1px solid ${emailColors.border}`,
  margin: '0',
  padding: '0 0 10px',
};

const lastRow = {
  borderBottom: 'none',
  paddingBottom: '0',
};

const labelStyle = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  fontWeight: '600',
  margin: '0 0 5px',
};

const valueStyle = {
  color: emailColors.defaultText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.body,
  fontWeight: '500',
  lineHeight: emailTypography.bodyLineHeight,
  margin: '0',
  whiteSpace: 'pre-line' as const,
};

const valueStrongStyle = {
  ...valueStyle,
  color: emailColors.strongText,
  fontWeight: '700',
};
