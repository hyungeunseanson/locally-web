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
  previewText: string;
  eyebrow?: string;
  helpPrompt?: string;
  helpLinkLabel?: string;
  helpLinkHref?: string;
  footerVariant?: EmailFooterVariant;
  children: React.ReactNode;
}

export default function EmailBaseLayout({
  previewText,
  eyebrow,
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
          <EmailHeader eyebrow={eyebrow} />
          <Section style={accentBar} />
          <Section style={content}>{children}</Section>
          {hasHelp ? (
            <Section style={helpSection} data-skip-in-text="true">
              <Hr style={divider} />
              <Text style={helpText}>
                {helpPrompt}{' '}
                <Link href={helpLinkHref} style={helpLink}>
                  {helpLinkLabel}
                </Link>
              </Text>
            </Section>
          ) : null}
          <Hr style={footerDivider} data-skip-in-text="true" />
          <EmailFooter variant={footerVariant} />
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: emailColors.canvas,
  fontFamily: EMAIL_FONT_STACK,
  padding: `${emailSpacing.outerDesktop} 0`,
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
  height: '4px',
  lineHeight: '4px',
  fontSize: '0',
};

const content = {
  padding: `${emailSpacing.contentDesktop} ${emailSpacing.contentDesktop} ${emailSpacing.sectionDesktop}`,
};

const helpSection = {
  padding: `0 ${emailSpacing.contentDesktop} ${emailSpacing.sectionDesktop}`,
};

const divider = {
  borderColor: emailColors.border,
  margin: '0 0 20px',
};

const footerDivider = {
  borderColor: emailColors.border,
  margin: `0 ${emailSpacing.contentDesktop}`,
};

const helpText = {
  color: emailColors.mutedText,
  fontFamily: EMAIL_FONT_STACK,
  fontSize: emailTypography.label,
  lineHeight: '1.6',
  margin: '0',
  textAlign: 'center' as const,
};

const helpLink = {
  color: emailColors.brandPrimary,
  fontWeight: '600',
  textDecoration: 'none',
};
