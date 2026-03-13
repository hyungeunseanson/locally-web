import type {
  PayPalApiErrorResponse,
  PayPalCaptureResult,
  PayPalCreateOrderParams,
  PayPalCreateOrderRequest,
  PayPalCurrencyCode,
  PayPalEnvironment,
  PayPalOrder,
  PayPalRefund,
  PayPalRefundResult,
  PayPalTokenResponse,
} from '@/app/types/paypal';

const PAYPAL_API_BASE: Record<PayPalEnvironment, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

const ZERO_DECIMAL_CURRENCIES = new Set<PayPalCurrencyCode>(['KRW']);

class PayPalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayPalConfigError';
  }
}

class PayPalApiError extends Error {
  status: number;
  debugId: string | undefined;
  details: PayPalApiErrorResponse['details'];

  constructor(message: string, status: number, payload?: PayPalApiErrorResponse) {
    super(message);
    this.name = 'PayPalApiError';
    this.status = status;
    this.debugId = payload?.debug_id;
    this.details = payload?.details;
  }
}

type PayPalRuntimeConfig = {
  clientId: string;
  clientSecret: string;
  environment: PayPalEnvironment;
  apiBase: string;
};

let tokenCache:
  | {
      accessToken: string;
      expiresAt: number;
      environment: PayPalEnvironment;
      clientId: string;
    }
  | null = null;

function resolveEnvironment(raw: string | undefined): PayPalEnvironment {
  return raw === 'live' ? 'live' : 'sandbox';
}

export function getPayPalRuntimeConfig(): PayPalRuntimeConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const environment = resolveEnvironment(process.env.PAYPAL_ENV);

  if (!clientId || !clientSecret) {
    throw new PayPalConfigError('PayPal environment variables are not configured.');
  }

  return {
    clientId,
    clientSecret,
    environment,
    apiBase: PAYPAL_API_BASE[environment],
  };
}

function encodeBasicAuth(clientId: string, clientSecret: string) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

async function parseApiError(response: Response): Promise<PayPalApiError> {
  let payload: PayPalApiErrorResponse | undefined;

  try {
    payload = (await response.json()) as PayPalApiErrorResponse;
  } catch {
    payload = undefined;
  }

  const detailText = payload?.details
    ?.map((detail) => detail.description || detail.issue)
    .filter(Boolean)
    .join(' | ');

  const message =
    payload?.message ||
    detailText ||
    `PayPal API request failed with status ${response.status}`;

  return new PayPalApiError(message, response.status, payload);
}

export async function getPayPalAccessToken(): Promise<string> {
  const config = getPayPalRuntimeConfig();

  if (
    tokenCache &&
    tokenCache.environment === config.environment &&
    tokenCache.clientId === config.clientId &&
    tokenCache.expiresAt > Date.now() + 60_000
  ) {
    return tokenCache.accessToken;
  }

  const response = await fetch(`${config.apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encodeBasicAuth(config.clientId, config.clientSecret)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  const token = (await response.json()) as PayPalTokenResponse;
  tokenCache = {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    environment: config.environment,
    clientId: config.clientId,
  };

  return token.access_token;
}

function toPayPalAmountValue(amount: number, currencyCode: PayPalCurrencyCode) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('PayPal amount must be a positive number.');
  }

  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) {
    return Math.round(amount).toString();
  }

  return amount.toFixed(2);
}

export function buildPayPalCreateOrderRequest(
  params: PayPalCreateOrderParams
): PayPalCreateOrderRequest {
  const currencyCode = params.currencyCode || 'USD';

  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: params.orderId,
        custom_id: params.orderId,
        description: params.description,
        amount: {
          currency_code: currencyCode,
          value: toPayPalAmountValue(params.amount, currencyCode),
        },
      },
    ],
  };
}

async function paypalFetch<T>(path: string, init: RequestInit): Promise<T> {
  const token = await getPayPalAccessToken();
  const { apiBase } = getPayPalRuntimeConfig();

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return (await response.json()) as T;
}

export async function createPayPalOrder(
  params: PayPalCreateOrderParams
): Promise<PayPalOrder> {
  const payload = buildPayPalCreateOrderRequest(params);

  return paypalFetch<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrder> {
  if (!orderId) {
    throw new Error('PayPal order id is required.');
  }

  return paypalFetch<PayPalOrder>(`/v2/checkout/orders/${orderId}`, {
    method: 'GET',
  });
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalCaptureResult> {
  if (!orderId) {
    throw new Error('PayPal order id is required.');
  }

  const order = await paypalFetch<PayPalOrder>(
    `/v2/checkout/orders/${orderId}/capture`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );

  const firstCapture = order.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    orderId: order.id,
    status: order.status,
    captureId: firstCapture?.id || null,
    amount: firstCapture?.amount || null,
    raw: order,
  };
}

export async function refundPayPalCapture(
  captureId: string,
  amount: number,
  currencyCode: PayPalCurrencyCode = 'KRW'
): Promise<PayPalRefundResult> {
  if (!captureId) {
    throw new Error('PayPal capture id is required.');
  }

  const body = JSON.stringify({
    amount: {
      currency_code: currencyCode,
      value: toPayPalAmountValue(amount, currencyCode),
    },
  });

  const refund = await paypalFetch<PayPalRefund>(
    `/v2/payments/captures/${captureId}/refund`,
    {
      method: 'POST',
      body,
    }
  );

  return {
    refundId: refund.id || null,
    status: refund.status || null,
    amount: refund.amount || null,
    raw: refund,
  };
}

export { PayPalApiError, PayPalConfigError };
