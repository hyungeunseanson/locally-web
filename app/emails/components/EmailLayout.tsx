import {
    Body,
    Container,
    Head,
    Hr,
    Html,
    Img,
    Preview,
    Section,
    Text,
} from '@react-email/components';
import * as React from 'react';

interface EmailLayoutProps {
    previewText?: string;
    headerTitle?: string;
    children: React.ReactNode;
}

export default function EmailLayout({ previewText, headerTitle, children }: EmailLayoutProps) {
    return (
        <Html>
            <Head />
            {previewText && <Preview>{previewText}</Preview>}
            <Body style={main}>
                <Container style={container}>
                    {/* Header Section */}
                    <Section style={header}>
                        <Text style={headerLogo}>{headerTitle || 'Locally'}</Text>
                    </Section>

                    {/* Main Content Area */}
                    <Section style={contentContainer}>
                        {children}
                    </Section>

                    {/* Footer Section */}
                    <Hr style={hr} />
                    <Section style={footer}>
                        <Text style={footerText}>
                            Locally - Travel like a local<br />
                            이 이메일은 발신 전용 메일입니다.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

// ---------------------------
// Styles (Inline CSS for Email)
// ---------------------------
const main = {
    backgroundColor: '#f7f7f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
    padding: '40px 0',
};

const container = {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '0',
    borderRadius: '16px', // 둥근 16px 곡률
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
    maxWidth: '600px',
};

const header = {
    backgroundColor: '#000000',
    padding: '24px 32px',
    textAlign: 'center' as const,
};

const headerLogo = {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '800',
    letterSpacing: '-0.5px',
    margin: '0',
};

const contentContainer = {
    padding: '32px',
};

const hr = {
    borderColor: '#eeeeee',
    margin: '0 32px',
};

const footer = {
    padding: '24px 32px',
    textAlign: 'center' as const,
};

const footerText = {
    color: '#9ca3af',
    fontSize: '12px',
    lineHeight: '1.5',
    margin: '0',
};
