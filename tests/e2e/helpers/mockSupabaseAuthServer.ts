import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const DEFAULT_PORT = 54329;

export const MOCK_AUTH_EMAIL = 'auth.regression@example.com';
export const MOCK_AUTH_PASSWORD = 'auth-regression-password';

type RecordedRequest = {
  method: string;
  url: string;
  bodyFields?: string[];
};

export type MockSupabaseAuthServer = {
  origin: string;
  requests: RecordedRequest[];
  resetRequests: () => void;
  close: () => Promise<void>;
  setRecoveryStatus: (status: number) => void;
  setPkceStatus: (status: number) => void;
  setUserStatus: (status: number) => void;
  setLogoutStatus: (status: number) => void;
};

const mockUser = {
  id: '7b683897-a429-45f1-9db1-338663f03d3c',
  aud: 'authenticated',
  role: 'authenticated',
  email: MOCK_AUTH_EMAIL,
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00.000Z',
  last_sign_in_at: '2026-01-01T00:00:00.000Z',
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    email: MOCK_AUTH_EMAIL,
    email_verified: true,
    full_name: 'Auth Regression User',
    preferred_locale: 'en',
  },
  identities: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  is_anonymous: false,
};

function encodeBase64Url(value: object) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createAccessToken(method: string) {
  const now = Math.floor(Date.now() / 1000);
  return [
    encodeBase64Url({ alg: 'HS256', typ: 'JWT' }),
    encodeBase64Url({
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      role: 'authenticated',
      session_id: randomUUID(),
      amr: [{ method, timestamp: now }],
      sub: mockUser.id,
      email: MOCK_AUTH_EMAIL,
    }),
    'local-test-signature',
  ].join('.');
}

function applyCors(request: IncomingMessage, response: ServerResponse) {
  response.setHeader('Access-Control-Allow-Origin', request.headers.origin ?? '*');
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'accept-profile, apikey, authorization, content-profile, content-type, prefer, range, x-client-info, x-supabase-api-version'
  );
  response.setHeader('Access-Control-Allow-Methods', 'DELETE, GET, HEAD, PATCH, POST, PUT, OPTIONS');
  response.setHeader('Access-Control-Expose-Headers', 'Content-Range');
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

function sendSession(response: ServerResponse, method = 'password', recoverySentAt: string | undefined = undefined) {
  sendJson(response, 200, {
    access_token: createAccessToken(method),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'local-refresh-token',
    user: { ...mockUser, recovery_sent_at: recoverySentAt },
  });
}

export async function startMockSupabaseAuthServer(
  port = DEFAULT_PORT
): Promise<MockSupabaseAuthServer> {
  const requests: RecordedRequest[] = [];
  let recoveryStatus = 200;
  let pkceStatus = 200;
  let userStatus = 200;
  let logoutStatus = 204;
  let recoverySentAt: string | undefined;

  const server = createServer((request, response) => {
    applyCors(request, response);

    const method = request.method ?? 'GET';
    const requestUrl = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
    requests.push({ method, url: requestUrl.toString() });

    if (method === 'OPTIONS') {
      response.statusCode = 204;
      response.end();
      return;
    }

    if (requestUrl.pathname === '/auth/v1/signup' && method === 'POST') {
      sendSession(response);
      return;
    }

    if (requestUrl.pathname === '/auth/v1/token' && method === 'POST') {
      if (requestUrl.searchParams.get('grant_type') === 'pkce' && pkceStatus !== 200) {
        sendJson(response, pkceStatus, { code: 'otp_expired', message: 'Sensitive provider diagnostic must never reach the UI' });
        return;
      }
      if (requestUrl.searchParams.get('grant_type') === 'pkce') {
        let raw = '';
        request.on('data', (chunk) => { raw += String(chunk); });
        request.on('end', () => {
          const input = JSON.parse(raw) as { auth_code?: string };
          sendSession(response, input.auth_code === 'mock-recovery-code' ? 'recovery' : 'oauth', recoverySentAt);
        });
      } else sendSession(response, 'password', recoverySentAt);
      return;
    }

    if (requestUrl.pathname === '/auth/v1/user' && method === 'GET') {
      sendJson(response, userStatus, userStatus === 200 ? { ...mockUser, recovery_sent_at: recoverySentAt } : { message: 'Session expired' });
      return;
    }

    if (requestUrl.pathname === '/auth/v1/user' && method === 'PUT') {
      let raw = '';
      request.on('data', (chunk) => { raw += String(chunk); });
      request.on('end', () => {
        const input = JSON.parse(raw) as Record<string, unknown>;
        const recorded = requests.findLast((entry) => entry.method === 'PUT');
        if (recorded) recorded.bodyFields = Object.keys(input);
        if (typeof input.password === 'string') recoverySentAt = undefined;
        sendJson(response, 200, { ...mockUser, recovery_sent_at: recoverySentAt });
      });
      return;
    }

    if (requestUrl.pathname === '/auth/v1/logout' && method === 'POST') {
      if (logoutStatus === 204) {
        response.statusCode = 204;
        response.end();
      } else sendJson(response, logoutStatus, { message: 'Session ended' });
      return;
    }

    if (requestUrl.pathname === '/auth/v1/recover' && method === 'POST') {
      if (recoveryStatus === 200) recoverySentAt = new Date().toISOString();
      sendJson(response, recoveryStatus, recoveryStatus === 200 ? {} : {
        code: recoveryStatus === 429 ? 'over_email_send_rate_limit' : 'user_not_found',
        message: 'Sensitive account detail must never reach the UI',
      });
      return;
    }

    if (requestUrl.pathname === '/auth/v1/authorize' && method === 'GET') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><title>Mock OAuth authorization</title>');
      return;
    }

    if (requestUrl.pathname.startsWith('/auth/v1/admin/users/') && method === 'GET') {
      sendJson(response, 200, { ...mockUser, recovery_sent_at: recoverySentAt });
      return;
    }

    if (requestUrl.pathname.startsWith('/rest/v1/') && method === 'HEAD') {
      response.statusCode = 200;
      response.setHeader('Content-Range', '*/0');
      response.end();
      return;
    }

    if (requestUrl.pathname.startsWith('/rest/v1/')) {
      const accept = request.headers.accept ?? '';
      sendJson(response, 200, accept.includes('application/vnd.pgrst.object+json') ? {} : []);
      return;
    }

    sendJson(response, 404, { message: `Unhandled mock Supabase route: ${method} ${requestUrl.pathname}` });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    resetRequests() {
      requests.length = 0;
      recoveryStatus = pkceStatus = userStatus = 200;
      logoutStatus = 204;
      recoverySentAt = undefined;
    },
    setRecoveryStatus(status) { recoveryStatus = status; },
    setPkceStatus(status) { pkceStatus = status; },
    setUserStatus(status) { userStatus = status; },
    setLogoutStatus(status) { logoutStatus = status; },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
