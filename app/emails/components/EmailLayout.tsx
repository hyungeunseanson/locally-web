import {
    Body,
    Container,
    Head,
    Hr,
    Html,
    Img,
    Link,
    Preview,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';
import { getSiteUrl } from '@/app/utils/siteUrl';

const INSTAGRAM_URL = 'https://www.instagram.com/locally.official';

interface EmailLayoutProps {
    previewText?: string;
    helpPrompt?: string;
    helpLinkLabel?: string;
    children: React.ReactNode;
}

export default function EmailLayout({
    previewText,
    helpPrompt = '궁금하신 점이 있으신가요?',
    helpLinkLabel = '도움 센터 방문하기 →',
    children,
}: EmailLayoutProps) {
    const siteUrl = getSiteUrl();

    return (
        <Html>
            <Head />
            {previewText && <Preview>{previewText}</Preview>}
            <Body style={main}>
                <Container style={container}>

                    {/* Header — white + logo */}
                    <Section style={header}>
                        <Img
                            src={`${siteUrl}/images/logo-black-transparent.png`}
                            alt="Locally"
                            width="100"
                            height="36"
                            style={{ objectFit: 'contain' }}
                        />
                    </Section>

                    {/* Brand accent line */}
                    <Section style={accentBar} />

                    {/* Main Content */}
                    <Section style={contentContainer}>
                        {children}
                    </Section>

                    {/* Help Section */}
                    <Section style={helpSection}>
                        <Hr style={helpHr} />
                        <Text style={helpText}>
                            {helpPrompt}{' '}
                            <Link href={`${siteUrl}/about`} style={helpLink}>
                                {helpLinkLabel}
                            </Link>
                        </Text>
                    </Section>

                    {/* Divider */}
                    <Hr style={hr} />

                    {/* Footer */}
                    <Section style={footer}>

                        {/* Instagram */}
                        <Text style={snsRow}>
                            <Link href={INSTAGRAM_URL} style={snsLink}>
                                📷 &nbsp;Instagram
                            </Link>
                        </Text>

                        {/* Address */}
                        <Text style={addressText}>
                            Locally Inc. · 2F #31, 16 Dongmun-ro, Ildo 1-dong,{'\n'}
                            Jeju-si, Jeju Special Self-Governing Province, South Korea{'\n'}
                            locally.partners@gmail.com · Business Reg. No. 2024-제주일도일-0021
                        </Text>

                        {/* Legal links */}
                        <Text style={legalText}>
                            <Link href={`${siteUrl}/privacy`} style={legalLink}>Privacy Policy</Link>
                            {' · '}
                            <Link href={`${siteUrl}/terms`} style={legalLink}>Terms of Service</Link>
                            {' · '}
                            <Link href={`mailto:locally.partners@gmail.com`} style={legalLink}>Unsubscribe</Link>
                        </Text>

                        <Text style={copyrightText}>
                            © 2026 Locally. All rights reserved.
                        </Text>
                    </Section>

                </Container>
            </Body>
        </Html>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const main = {
    backgroundColor: '#f7f7f7',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    padding: '40px 0',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '0',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
    maxWidth: '600px',
};

const header = {
    backgroundColor: '#ffffff',
    padding: '22px 32px',
    textAlign: 'center' as const,
    borderBottom: '1px solid #f0f0f0',
};

const accentBar = {
    backgroundColor: '#FF385C',
    height: '4px',
    lineHeight: '4px',
    fontSize: '0',
};

const contentContainer = {
    padding: '36px 32px 24px',
};

const helpSection = {
    padding: '0 32px 28px',
};

const helpHr = {
    borderColor: '#eeeeee',
    margin: '0 0 20px 0',
};

const helpText = {
    fontSize: '13px',
    color: '#6b7280',
    textAlign: 'center' as const,
    margin: '0',
    lineHeight: '1.5',
};

const helpLink = {
    color: '#FF385C',
    textDecoration: 'none',
    fontWeight: '600',
};

const hr = {
    borderColor: '#eeeeee',
    margin: '0 32px',
};

const footer = {
    padding: '28px 32px',
    textAlign: 'center' as const,
};

const snsRow = {
    margin: '0 0 20px 0',
};

const snsLink = {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '20px',
    color: '#374151',
    fontSize: '13px',
    fontWeight: '600',
    padding: '7px 18px',
    textDecoration: 'none',
    display: 'inline-block',
};

const addressText = {
    color: '#9ca3af',
    fontSize: '11px',
    lineHeight: '1.8',
    margin: '0 0 8px 0',
    whiteSpace: 'pre-line' as const,
};

const legalText = {
    color: '#9ca3af',
    fontSize: '11px',
    margin: '8px 0',
    lineHeight: '1.6',
};

const legalLink = {
    color: '#9ca3af',
    textDecoration: 'underline',
};

const copyrightText = {
    color: '#c4c4c4',
    fontSize: '11px',
    margin: '12px 0 0 0',
};
