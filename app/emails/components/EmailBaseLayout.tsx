import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import EmailFooter from './EmailFooter';
import EmailHeader from './EmailHeader';
import type { EmailLocale } from '@/app/emails/registry/emailTypes';
import type { EmailFooterVariant } from '@/app/emails/theme/variants';
import {
  emailColors,
  EMAIL_FONT_STACK,
  EMAIL_MAX_WIDTH,
  emailRadii,
  emailShadows,
  emailSpacing,
  emailTypography,
} from '@/app/emails/theme/tokens';

interface EmailBaseLayoutProps {
  locale: EmailLocale;
  previewText: string;
  helpPrompt?: string;
  helpLinkLabel?: string;
  helpLinkHref?: string;
  footerVariant?: EmailFooterVariant;
  children: React.ReactNode;
}

export default function EmailBaseLayout({
  locale,
  previewText,
  helpPrompt,
  helpLinkLabel,
  helpLinkHref,
  footerVariant = 'transactional',
  children,
}: EmailBaseLayoutProps) {
  const hasHelp = Boolean(helpPrompt && helpLinkLabel && helpLinkHref);

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <EmailHeader />
          <Section style={accentBar} />
          <Section style={content}>{children}</Section>
          {hasHelp ? (
            <Section style={helpSection} data-skip-in-text="true">
              <Text style={helpText}>
                {helpPrompt}
              </Text>
              <Text style={helpLinkRow}>
                <Link href={helpLinkHref} style={helpLink}>
                  {helpLinkLabel}
                </Link>
              </Text>
            </Section>
          ) : null}
          <Hr style={footerDivider} data-skip-in-text="true" />
          <EmailFooter variant={footerVariant} locale={locale} />
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: emailColors.canvas,
  fontFamily: EMAIL_FONT_STACK,
  padding: `${emailSpacing.outerDesktop} 12px`,
};

const container = {
  backgroundColor: emailColors.surface,
  borderRadius: emailRadii.container,
  boxShadow: emailShadows.container,
  margin: '0 auto',
  maxWidth: `${EMAIL_MAX_WIDTH}px`,
  overflow: 'hidden',
};

const accentBar = {
  backgroundColor: emailColors.brandPrimary,
  height: '2px',
  lineHeight: '2px',
  fontSize: '0',
};

const content = {
  padding: `${emailSpacing.contentDesktop} ${emailSpacing.contentDesktop} ${emailSpacing.sectionDesktop}`,
};

const helpSection = {
  backgroundColor: emailColors.subtle,
  border: `1px solid ${emailColors.border}`,
  borderRadius: emailRadii.card,
  margin: `0 ${emailSpacing.contentDesktop} ${emailSpacing.sectionDesktop}`,
  padding: '12px 14px',
};

const footerDivider = {
  borderColor: emailColors.border,
  margin: `0 ${emailSpacing.contentDesktop} 0`,
};

const helpText = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  lineHeight: '1.6',
  margin: '0 0 4px',
  textAlign: 'left' as const,
};

const helpLinkRow = {
  margin: '0',
  textAlign: 'left' as const,
};

const helpLink = {
  color: emailColors.brandPrimary,
  fontWeight: '600',
  textDecoration: 'none',
};
