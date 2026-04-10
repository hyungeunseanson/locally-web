import { Button } from '@react-email/components';
import * as React from 'react';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailRadii,
} from '@/app/emails/theme/tokens';

interface EmailPrimaryCTAProps {
  href: string;
  children: React.ReactNode;
}

export default function EmailPrimaryCTA({
  href,
  children,
}: EmailPrimaryCTAProps) {
  return (
    <Button href={href} style={buttonStyle}>
      {children}
    </Button>
  );
}

const buttonStyle = {
  backgroundColor: emailColors.brandPrimary,
  borderRadius: emailRadii.button,
  color: '#ffffff',
  display: 'inline-block',
  fontFamily: EMAIL_FONT_STACK,
  fontSize: '14px',
  fontWeight: '700',
  minHeight: '48px',
  padding: '16px 0',
  textAlign: 'center' as const,
  textDecoration: 'none',
  width: '100%',
};
