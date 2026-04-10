import { Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { buildAbsoluteUrl } from '@/app/utils/siteUrl';
import type { EmailFooterVariant } from '@/app/emails/theme/variants';
import {
  emailColors,
  EMAIL_FONT_STACK,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailFooterProps {
  variant?: EmailFooterVariant;
}

export default function EmailFooter({
  variant = 'transactional',
}: EmailFooterProps) {
  if (variant === 'opsAdmin') {
    return (
      <Section style={footerSection} data-skip-in-text="true">
        <Text style={metaText}>Locally Ops Mail</Text>
        <Text style={legalText}>
          Internal operational notification. Please review in the admin dashboard.
        </Text>
      </Section>
    );
  }

  return (
    <Section style={footerSection} data-skip-in-text="true">
      <Text style={metaText}>Locally Inc.</Text>
      <Text style={legalText}>
        Support: <Link href="mailto:locally.partners@gmail.com" style={link}>locally.partners@gmail.com</Link>
      </Text>
      <Text style={legalText}>
        <Link href={buildAbsoluteUrl('/privacy')} style={link}>Privacy</Link>
        {' · '}
        <Link href={buildAbsoluteUrl('/terms')} style={link}>Terms</Link>
      </Text>
      <Text style={finePrint}>
        2F #31, 16 Dongmun-ro, Ildo 1-dong, Jeju-si, Jeju Special Self-Governing Province, South Korea
      </Text>
      <Text style={finePrint}>© 2026 Locally. All rights reserved.</Text>
    </Section>
  );
}

const footerSection = {
  padding: '24px 32px 28px',
  textAlign: 'center' as const,
};

const metaText = {
  color: emailColors.strongText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.footer,
  fontWeight: '600',
  margin: '0 0 6px',
};

const legalText = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.footer,
  lineHeight: '1.7',
  margin: '0 0 4px',
};

const finePrint = {
  color: '#9CA3AF',
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.footer,
  lineHeight: '1.7',
  margin: '4px 0 0',
};

const link = {
  color: emailColors.mutedText,
  textDecoration: 'underline',
};
