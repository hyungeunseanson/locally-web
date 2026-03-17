import { ImageResponse } from 'next/og';

export const alt = 'Locally';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://locally-web.vercel.app';

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
          width={280}
          height={280}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size }
  );
}
