/**
 * API keys identify an application; user access tokens identify a session.
 * Keep legacy Bearer fallback only for JWT-era keys. Modern opaque keys belong
 * on apikey. This transport choice never grants application permissions.
 *
 * @param {string} apiKey
 * @param {{ headers?: HeadersInit, accessToken?: string }} [options]
 * @returns {Record<string, string>}
 */
export function createSupabaseApiKeyHeaders(apiKey, { headers = {}, accessToken } = {}) {
  const key = credentialString(apiKey);
  let result;
  try {
    result = new Headers(headers);
    result.set('apikey', key);
    const existingToken = result.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (existingToken && isModernApiKey(existingToken)) {
      throw new Error('invalid_session_token');
    }
    if (accessToken !== undefined) {
      const token = credentialString(accessToken);
      if (token === key || isModernApiKey(token)) {
        throw new Error('invalid_session_token');
      }
      result.set('authorization', `Bearer ${token}`);
    } else if (!result.has('authorization') && !isModernApiKey(key)) {
      result.set('authorization', `Bearer ${key}`);
    }
    return Object.fromEntries(result.entries());
  } catch {
    // Native Headers errors may include the rejected value. Never forward it.
    throw new Error('supabase_request_headers_invalid');
  }
}

/** @param {unknown} value */
function credentialString(value) {
  if (typeof value !== 'string' || !value.trim() || /\s/.test(value.trim())) {
    throw new Error('supabase_api_credential_invalid');
  }
  return value.trim();
}

/** @param {string} value */
function isModernApiKey(value) {
  return value.startsWith('sb_secret_') || value.startsWith('sb_publishable_');
}

/**
 * Offline configuration validation only, NOT JWT verification or user
 * authorization. The Supabase server still authenticates every credential.
 * SUPABASE_SERVICE_ROLE_KEY remains a compatibility alias for either format.
 *
 * @param {unknown} value
 * @returns {'modern_secret' | 'legacy_service_role'}
 */
export function validateSupabasePrivilegedKey(value) {
  try {
    const key = credentialString(value);
    if (/^sb_secret_[A-Za-z0-9_-]+$/.test(key)) return 'modern_secret';
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error('invalid_privileged_key');
    }
    const [header, payload] = key.split('.').slice(0, 2).map((part) => {
      const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    });
    if (header?.alg === 'HS256' && payload?.role === 'service_role') {
      return 'legacy_service_role';
    }
  } catch {
    // No key, decoded claim, or native parse error is included in diagnostics.
  }
  throw new Error('supabase_privileged_api_key_invalid');
}

/**
 * Prevent transport/provider exception text from reaching operator CLI logs.
 * @param {string | URL | Request} input
 * @param {RequestInit} [init]
 * @param {typeof fetch} [fetchImplementation]
 */
export async function fetchSupabase(input, init, fetchImplementation = fetch) {
  try {
    return await fetchImplementation(input, init);
  } catch {
    throw new Error('supabase_request_transport_failed');
  }
}

/** @param {Response} response */
export async function readSupabaseJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error('supabase_response_invalid_json');
  }
}
