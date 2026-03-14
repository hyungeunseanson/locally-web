type PortOneTokenEnvelope = {
  code: number;
  message?: string;
  response?: {
    access_token?: string;
  };
};

type PortOnePaymentEnvelope = {
  code: number;
  message?: string;
  response?: {
    imp_uid?: string;
    merchant_uid?: string;
    amount?: number;
    status?: string;
    pg_tid?: string;
  };
};

type PortOneRuntimeConfig = {
  apiKey: string;
  apiSecret: string;
};

export type PortOnePayment = NonNullable<PortOnePaymentEnvelope['response']>;

export class PortOneConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortOneConfigError';
  }
}

function getPortOneRuntimeConfig(): PortOneRuntimeConfig {
  const apiKey = process.env.PORTONE_API_KEY;
  const apiSecret = process.env.PORTONE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new PortOneConfigError('PortOne server credentials are not configured.');
  }

  return {
    apiKey,
    apiSecret,
  };
}

async function parsePortOneJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`PortOne API returned invalid JSON (HTTP ${response.status}).`);
  }
}

export function isPortOneServiceCardReady() {
  const hasImpCode = Boolean(process.env.NEXT_PUBLIC_PORTONE_IMP_CODE);
  const hasCredentials = Boolean(process.env.PORTONE_API_KEY && process.env.PORTONE_API_SECRET);

  if (!hasImpCode) {
    return {
      ready: false as const,
      reason: 'missing_imp_code' as const,
    };
  }

  if (!hasCredentials) {
    return {
      ready: false as const,
      reason: 'missing_portone_credentials' as const,
    };
  }

  return {
    ready: true as const,
  };
}

export async function getPortOneAccessToken() {
  const { apiKey, apiSecret } = getPortOneRuntimeConfig();

  const response = await fetch('https://api.iamport.kr/users/getToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      imp_key: apiKey,
      imp_secret: apiSecret,
    }),
    cache: 'no-store',
  });

  const payload = await parsePortOneJson<PortOneTokenEnvelope>(response);
  if (!response.ok || payload.code !== 0 || !payload.response?.access_token) {
    throw new Error(payload.message || 'Failed to fetch PortOne access token.');
  }

  return payload.response.access_token;
}

export async function getPortOnePayment(impUid: string): Promise<PortOnePayment> {
  if (!impUid) {
    throw new Error('PortOne imp_uid is required.');
  }

  const accessToken = await getPortOneAccessToken();
  const response = await fetch(`https://api.iamport.kr/payments/${encodeURIComponent(impUid)}`, {
    method: 'GET',
    headers: {
      Authorization: accessToken,
    },
    cache: 'no-store',
  });

  const payload = await parsePortOneJson<PortOnePaymentEnvelope>(response);
  if (!response.ok || payload.code !== 0 || !payload.response) {
    throw new Error(payload.message || 'Failed to fetch PortOne payment.');
  }

  return payload.response;
}
