import { ImageResponse } from 'next/og';

// The OG image renderer consumes a plain asset URL inside next/og, so raw img is the compatible render primitive here.

import { getSiteUrl } from '@/app/utils/siteUrl';

export const alt = 'Locally';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const siteUrl = getSiteUrl();

  return new ImageResponse(
    (
      <div
        style={{
          background: '#F8F8F8',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={`${siteUrl}/images/logo-black-transparent.png`}
          alt="Locally"
          width={280}
          height={280}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  );
}
