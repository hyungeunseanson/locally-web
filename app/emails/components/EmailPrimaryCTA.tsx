import { Button, Section } from '@react-email/components';
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
    <Section style={buttonWrap}>
      <Button href={href} style={buttonStyle}>
        {children}
      </Button>
    </Section>
  );
}

const buttonWrap = {
  margin: '4px 0 0',
  textAlign: 'left' as const,
};

const buttonStyle = {
  backgroundColor: emailColors.brandPrimary,
  borderRadius: emailRadii.button,
  color: '#ffffff',
  display: 'inline-block',
  fontFamily: EMAIL_FONT_STACK,
  fontSize: '13px',
  fontWeight: '700',
  padding: '11px 18px',
  textAlign: 'center' as const,
  textDecoration: 'none',
};
