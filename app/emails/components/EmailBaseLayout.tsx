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
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{responsiveEmailStyles}</style>
      </Head>
      <Preview>{previewText}</Preview>
      <Body className="locally-email-body" style={body}>
        <Container className="locally-email-container" style={container}>
          <EmailHeader />
          <Section className="locally-email-content" style={content}>{children}</Section>
          {hasHelp ? (
            <Section className="locally-email-help" style={helpSection} data-skip-in-text="true">
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
          <Hr className="locally-email-footer-divider" style={footerDivider} data-skip-in-text="true" />
          <EmailFooter variant={footerVariant} locale={locale} />
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: emailColors.canvas,
  fontFamily: EMAIL_FONT_STACK,
  margin: '0',
  padding: emailSpacing.outerMobile,
  width: '100%',
  WebkitTextSizeAdjust: '100%',
};

const container = {
  backgroundColor: emailColors.surface,
  borderRadius: '0',
  boxShadow: 'none',
  margin: '0 auto',
  maxWidth: `${EMAIL_MAX_WIDTH}px`,
  overflow: 'hidden',
  width: '100%',
};

const content = {
  padding: `24px ${emailSpacing.contentMobile} ${emailSpacing.sectionMobile}`,
};

const helpSection = {
  backgroundColor: emailColors.surface,
  margin: `0 ${emailSpacing.contentMobile} ${emailSpacing.sectionMobile}`,
  padding: '2px 0 16px',
};

const footerDivider = {
  borderColor: emailColors.border,
  margin: `0 ${emailSpacing.contentMobile} 0`,
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
  color: emailColors.strongText,
  fontWeight: '600',
  textDecoration: 'none',
};

const responsiveEmailStyles = `
@media screen and (min-width: 640px) {
  .locally-email-body {
    background-color: ${emailColors.desktopCanvas} !important;
    padding: ${emailSpacing.outerDesktop} 12px !important;
  }

  .locally-email-container {
    border-radius: ${emailRadii.container} !important;
    box-shadow: ${emailShadows.container} !important;
  }

  .locally-email-header {
    padding: 24px ${emailSpacing.contentDesktop} 0 !important;
  }

  .locally-email-wordmark {
    font-size: 18px !important;
  }

  .locally-email-content {
    padding: 28px ${emailSpacing.contentDesktop} ${emailSpacing.sectionDesktop} !important;
  }

  .locally-email-title {
    font-size: ${emailTypography.titleDesktop} !important;
  }

  .locally-email-help {
    margin: 0 ${emailSpacing.contentDesktop} ${emailSpacing.sectionDesktop} !important;
  }

  .locally-email-footer-divider {
    margin: 0 ${emailSpacing.contentDesktop} !important;
  }

  .locally-email-footer {
    padding: 20px ${emailSpacing.contentDesktop} 28px !important;
  }

  .locally-email-cta {
    display: inline-block !important;
    width: auto !important;
    min-width: 0 !important;
  }

  .locally-email-panel {
    padding: 18px !important;
  }
}
`;
