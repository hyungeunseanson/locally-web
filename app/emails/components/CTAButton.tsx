import * as React from 'react';
import EmailPrimaryCTA from './EmailPrimaryCTA';

interface CTAButtonProps {
  href: string;
  children: React.ReactNode;
}

export default function CTAButton({ href, children }: CTAButtonProps) {
  return <EmailPrimaryCTA href={href}>{children}</EmailPrimaryCTA>;
}
