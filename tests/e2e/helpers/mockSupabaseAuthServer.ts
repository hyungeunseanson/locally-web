import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const DEFAULT_PORT = 54329;

export const MOCK_AUTH_EMAIL = 'auth.regression@example.com';
export const MOCK_AUTH_PASSWORD = 'auth-regression-password';

type RecordedRequest = {
  method: string;
  url: string;
};

export type MockSupabaseAuthServer = {
  origin: string;
  requests: RecordedRequest[];
  resetRequests: () => void;
  close: () => Promise<void>;
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

function createAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  return [
    encodeBase64Url({ alg: 'HS256', typ: 'JWT' }),
    encodeBase64Url({
      aud: 'authenticated',
      exp: now + 3600,
      iat: now,
      role: 'authenticated',
      session_id: '8b8c2d18-b330-4f20-83f3-a84a7dcb7a14',
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

function sendSession(response: ServerResponse) {
  sendJson(response, 200, {
    access_token: createAccessToken(),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'local-refresh-token',
    user: mockUser,
  });
}

export async function startMockSupabaseAuthServer(
  port = DEFAULT_PORT
): Promise<MockSupabaseAuthServer> {
  const requests: RecordedRequest[] = [];

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

    if (requestUrl.pathname === '/auth/v1/token' && method === 'POST') {
      sendSession(response);
      return;
    }

    if (requestUrl.pathname === '/auth/v1/user' && method === 'GET') {
      sendJson(response, 200, mockUser);
      return;
    }

    if (requestUrl.pathname === '/auth/v1/user' && method === 'PUT') {
      sendJson(response, 200, mockUser);
      return;
    }

    if (requestUrl.pathname === '/auth/v1/logout' && method === 'POST') {
      response.statusCode = 204;
      response.end();
      return;
    }

    if (requestUrl.pathname === '/auth/v1/authorize' && method === 'GET') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html><title>Mock OAuth authorization</title>');
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
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
