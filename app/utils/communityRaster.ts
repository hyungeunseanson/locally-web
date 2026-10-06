import { communityMime, COMMUNITY_MAX_BYTES } from './communityMediaContract.mjs';
import { hasExpectedExperienceImageMagic } from './experienceMediaSource';
export type CommunityImageDecoder = {
  info(stream: ReadableStream<Uint8Array>): Promise<{ width?: number; height?: number; format?: string }>;
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width: number; height: number; fit: 'cover' }): {
      output(options: { format: 'image/png' }): Promise<{ response(): Response }>;
    };
  };
};
export class CommunityMediaError extends Error {
  constructor(readonly code: string, readonly status = 503) { super(code); }
}
export function validateCommunityImageMagic(bytes: Uint8Array, value: string) {
  let mime: string;
  try { mime = communityMime(value); } catch { throw new CommunityMediaError('community_mime_invalid', 400); }
  if (!bytes.length || bytes.length > COMMUNITY_MAX_BYTES) throw new CommunityMediaError('community_size_invalid', 413);
  const avif = mime !== 'image/avif' || (bytes.length >= 16 && new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp' && /avif|avis/.test(new TextDecoder().decode(bytes.slice(8, 64))));
  if (!hasExpectedExperienceImageMagic(bytes, mime) || !avif) throw new CommunityMediaError('community_magic_invalid', 400);
  return mime;
}
/** Decode before registration/PUT. Tiny output is discarded; original bytes never change. */
export async function validateCommunityRaster(bytes: Uint8Array, value: string, decoder: CommunityImageDecoder) {
  const mime = validateCommunityImageMagic(bytes, value);
  if (!decoder) throw new CommunityMediaError('community_decoder_unavailable');
  const stream = () => new Blob([bytes.slice().buffer]).stream();
  try {
    const info = await decoder.info(stream());
    if (!Number.isSafeInteger(info.width) || !Number.isSafeInteger(info.height) || !info.width || !info.height || info.width < 0 || info.height < 0 || info.width * info.height > 100_000_000) throw Error('invalid_dimensions');
    const output = await decoder.input(stream()).transform({ width: 1, height: 1, fit: 'cover' }).output({ format: 'image/png' });
    const response = output.response(), reader = response.body?.getReader();
    if (!response.ok || !reader) throw Error('decode_failed');
    let size = 0;
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 65536) throw Error('decode_output_bound'); } }
    finally { await reader.cancel(); reader.releaseLock(); }
    if (!size) throw Error('empty_decode');
  } catch { throw new CommunityMediaError('community_image_malformed', 400); }
  return mime;
}
