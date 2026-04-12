import * as React from 'react';
import EmailBaseLayout from './EmailBaseLayout';

interface EmailLayoutProps {
  previewText?: string;
  helpPrompt?: string;
  helpLinkLabel?: string;
  children: React.ReactNode;
}

export default function EmailLayout({
  previewText,
  helpPrompt = '궁금하신 점이 있으신가요?',
  helpLinkLabel = '도움 센터 방문하기',
  children,
}: EmailLayoutProps) {
  return (
    <EmailBaseLayout
      locale="ko"
      previewText={previewText || ''}
      helpPrompt={helpPrompt}
      helpLinkLabel={helpLinkLabel}
      helpLinkHref="/about"
      footerVariant="transactional"
    >
      {children}
    </EmailBaseLayout>
  );
}
