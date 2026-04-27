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
      <Button href={href} className="locally-email-cta" style={buttonStyle}>
        {children}
      </Button>
    </Section>
  );
}

const buttonWrap = {
  margin: '16px 0 0',
  textAlign: 'left' as const,
};

const buttonStyle = {
  backgroundColor: emailColors.ctaBackground,
  borderRadius: emailRadii.pill,
  boxSizing: 'border-box' as const,
  color: '#ffffff',
  display: 'block',
  fontFamily: EMAIL_FONT_STACK,
  fontSize: '14px',
  fontWeight: '700',
  lineHeight: '20px',
  minHeight: '48px',
  padding: '14px 22px',
  textAlign: 'center' as const,
  textDecoration: 'none',
  width: '100%',
};
