import { Img, Section } from '@react-email/components';
import * as React from 'react';
import { getSiteUrl } from '@/app/utils/siteUrl';
import {
  emailColors,
} from '@/app/emails/theme/tokens';

export default function EmailHeader() {
  return (
    <Section style={header}>
      <Img
        src={`${getSiteUrl()}/images/logo-black-transparent.png`}
        alt="Locally"
        width="88"
        height="32"
        style={logo}
      />
    </Section>
  );
}

const header = {
  backgroundColor: emailColors.surface,
  padding: '18px 24px 0',
  textAlign: 'center' as const,
};

const logo = {
  objectFit: 'contain' as const,
  margin: '0 auto',
};
