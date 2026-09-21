const PRODUCTION_SUPABASE_HOST = 'uhinvcydgzqlpnvieyal.supabase.co';
const PUBLIC_EXPERIENCE_OBJECT_PREFIX = '/storage/v1/object/public/experiences/';
const PUBLIC_EXPERIENCE_OBJECT_KEY_PATTERN =
  /^experience\/([^/]+)\/(?:hero|itinerary)\/[A-Za-z0-9._-]+$/;
const PUBLIC_EXPERIENCE_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_EXPERIENCE_R2_HOST = 'media-canary.locally-travel.com';
const PUBLIC_EXPERIENCE_R2_SOURCE_KEY_PATTERN =
  /^sources\/v1\/experience\/[0-9a-f]{64}\/([^/]+)\/(?:hero|itinerary)\.(?:avif|gif|jpe?g|png|webp)$/;
const PUBLIC_EXPERIENCE_R2_ORIGINAL_KEY_PATTERN =
  /^originals\/v1\/([0-9a-f]{2})\/([0-9a-f]{64})\/([0-9a-f]{64})\.(?:avif|gif|jpe?g|png|webp)$/;

/**
 * @typedef {'supabase' | 'r2'} PublicExperienceSourceKind
 * @typedef {{
 *   sourceUrl: string,
 *   sourceKey: string,
 *   sourceKeySha256: string,
 *   sourceByteSha256: string | null,
 *   derivativeIdentity: string,
 *   sourceKind: PublicExperienceSourceKind,
 *   r2Key: string | null,
 * }} PublicExperienceSource
 */

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

/**
 * Browser-safe synchronous SHA-256 shared by runtime and Node contracts.
 *
 * @param {string} value
 * @returns {string}
 */
export function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rightRotate(left, 7) ^ rightRotate(left, 18) ^ (left >>> 3);
      const sigma1 = rightRotate(right, 17) ^ rightRotate(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choice + constants[index] + words[index]) >>> 0;
      const sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, '0')).join('');
}

/**
 * @param {string} sourceUrl
 * @returns {PublicExperienceSource}
 */
export function normalizePublicExperienceSourceUrl(sourceUrl) {
  let parsed;
  try {
    if (typeof sourceUrl !== 'string') throw new TypeError('source URL must be a string');
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error('Public experience media source URL is invalid.');
  }

  // WHATWG URL normalizes an explicit default :443 to an empty `port`; inspect
  // the raw authority as well so canonical origins cannot carry an explicit port.
  const authority = sourceUrl.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/)?.[1] || '';
  const hostPort = authority.slice(authority.lastIndexOf('@') + 1);
  const hasExplicitPort = Boolean(parsed.port || /:\d+$/.test(hostPort));
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || hasExplicitPort) {
    throw new Error('Public experience media source URL is outside the approved origin.');
  }

  if (parsed.hostname === PUBLIC_EXPERIENCE_R2_HOST) {
    const encodedKey = parsed.pathname.replace(/^\//, '');
    let r2Key;
    try {
      r2Key = encodedKey.split('/').map(decodeURIComponent).join('/');
    } catch {
      throw new Error('Public experience media source key encoding is invalid.');
    }
    const originalMatch = r2Key.match(PUBLIC_EXPERIENCE_R2_ORIGINAL_KEY_PATTERN);
    if (originalMatch) {
      if (originalMatch[1] !== originalMatch[2].slice(0, 2)) {
        throw new Error('Migrated original shard does not match its source identity.');
      }
      const legacyIdentity = parsed.searchParams.get('legacy');
      if (
        !legacyIdentity ||
        !/^[0-9a-f]{12}$/.test(legacyIdentity) ||
        [...parsed.searchParams.entries()].length !== 1 ||
        [...parsed.searchParams.keys()].some((key) => key !== 'legacy')
      ) {
        throw new Error('Migrated original requires one bounded legacy identity.');
      }
      return {
        sourceUrl,
        sourceKey: r2Key,
        sourceKeySha256: originalMatch[2],
        sourceByteSha256: originalMatch[3],
        derivativeIdentity: legacyIdentity,
        sourceKind: 'r2',
        r2Key,
      };
    }
    const sourceMatch = r2Key.match(PUBLIC_EXPERIENCE_R2_SOURCE_KEY_PATTERN);
    if (parsed.search || !sourceMatch || !PUBLIC_EXPERIENCE_UUID_PATTERN.test(sourceMatch[1])) {
      throw new Error('Public experience media R2 source key is outside the approved namespace.');
    }
    return {
      sourceUrl,
      sourceKey: r2Key,
      sourceKeySha256: sha256Hex(r2Key),
      sourceByteSha256: null,
      derivativeIdentity: sha256Hex(sourceUrl).slice(0, 12),
      sourceKind: 'r2',
      r2Key,
    };
  }

  if (
    parsed.hostname !== PRODUCTION_SUPABASE_HOST ||
    parsed.search ||
    !parsed.pathname.startsWith(PUBLIC_EXPERIENCE_OBJECT_PREFIX)
  ) {
    throw new Error('Public experience media source URL is outside the approved origin.');
  }

  const encodedKey = parsed.pathname.slice(PUBLIC_EXPERIENCE_OBJECT_PREFIX.length);
  let sourceKey;
  try {
    sourceKey = encodedKey.split('/').map(decodeURIComponent).join('/');
  } catch {
    throw new Error('Public experience media source key encoding is invalid.');
  }
  const objectMatch = sourceKey.match(PUBLIC_EXPERIENCE_OBJECT_KEY_PATTERN);
  if (!objectMatch || !PUBLIC_EXPERIENCE_UUID_PATTERN.test(objectMatch[1])) {
    throw new Error('Public experience media source key is outside the approved namespace.');
  }

  return {
    sourceUrl,
    sourceKey,
    sourceKeySha256: sha256Hex(sourceKey),
    sourceByteSha256: null,
    derivativeIdentity: sha256Hex(sourceUrl).slice(0, 12),
    sourceKind: 'supabase',
    r2Key: null,
  };
}
