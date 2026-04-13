import { buildAdsTxtEntry } from '@/app/utils/adsense';

export function GET() {
  const entry = buildAdsTxtEntry(process.env);

  if (!entry) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  return new Response(`${entry}\n`, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
