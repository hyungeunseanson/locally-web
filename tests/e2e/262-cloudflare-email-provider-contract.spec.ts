import { expect, test } from '@playwright/test';

import {
  resolveEmailTransportProvider,
  sendWithCloudflareEmail,
  type EmailEnv,
} from '@/app/emails/delivery/sendTemplatedEmail';

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

let restoreFetch: (() => void) | null = null;

function stubFetch(response: {
  status: number;
  body?: unknown;
  throws?: boolean;
}) {
  const calls: FetchCall[] = [];
  const previousFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    if (response.throws) {
      throw new Error('simulated network failure');
    }

    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  restoreFetch = () => {
    globalThis.fetch = previousFetch;
  };

  return calls;
}

const cloudflareEnv: EmailEnv = {
  EMAIL_TRANSPORT_PROVIDER: 'cloudflare',
  CLOUDFLARE_ACCOUNT_ID: 'account-id',
  CLOUDFLARE_EMAIL_API_TOKEN: 'test-token',
};

const renderedEmail = {
  to: 'customer@example.test',
  subject: '[Locally] Cloudflare provider contract',
  html: '<p>Rendered HTML</p>',
  text: 'Rendered text',
};

test.describe('Cloudflare Email Sending REST provider contract', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterEach(() => {
    restoreFetch?.();
    restoreFetch = null;
  });

  test('keeps Gmail as the safe default and only selects Cloudflare explicitly', () => {
    expect(resolveEmailTransportProvider({})).toBe('gmail');
    expect(resolveEmailTransportProvider({ EMAIL_TRANSPORT_PROVIDER: '' })).toBe('gmail');
    expect(resolveEmailTransportProvider({ EMAIL_TRANSPORT_PROVIDER: 'gmail' })).toBe('gmail');
    expect(resolveEmailTransportProvider({ EMAIL_TRANSPORT_PROVIDER: 'cloudflare' })).toBe('cloudflare');
    expect(resolveEmailTransportProvider({ EMAIL_TRANSPORT_PROVIDER: 'unknown' })).toBe('gmail');
  });

  test('does not call Cloudflare when its selected provider is not configured', async () => {
    const calls = stubFetch({
      status: 200,
      body: { success: true, errors: [], messages: [], result: {} },
    });

    await expect(
      sendWithCloudflareEmail(renderedEmail, {
        EMAIL_TRANSPORT_PROVIDER: 'cloudflare',
      })
    ).rejects.toThrow('Cloudflare Email Sending is not configured');
    expect(calls).toHaveLength(0);
  });

  test('sends one named-address REST request with the existing rendered content', async () => {
    const calls = stubFetch({
      status: 200,
      body: {
        success: true,
        errors: [],
        messages: [],
        result: {
          queued: ['customer@example.test'],
          delivered: [],
          permanent_bounces: [],
        },
      },
    });

    await sendWithCloudflareEmail(renderedEmail, cloudflareEnv);
    expect(calls).toHaveLength(1);

    const call = calls[0];
    expect(String(call.input)).toBe(
      'https://api.cloudflare.com/client/v4/accounts/account-id/email/sending/send'
    );
    expect(call.init?.method).toBe('POST');
    expect(call.init?.headers).toEqual({
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(String(call.init?.body));
    expect(body).toEqual({
      to: 'customer@example.test',
      from: {
        address: 'support@locally-travel.com',
        name: 'Locally',
      },
      reply_to: 'support@locally-travel.com',
      subject: renderedEmail.subject,
      html: renderedEmail.html,
      text: renderedEmail.text,
    });
  });

  test('treats API failures as terminal and makes exactly one request without Gmail fallback', async () => {
    const failureCases = [
      { status: 401, body: { success: false, errors: [{ code: 10101 }], result: null } },
      { status: 403, body: { success: false, errors: [{ code: 10102 }], result: null } },
      { status: 429, body: { success: false, errors: [{ code: 10004 }], result: null } },
      { status: 500, body: { success: false, errors: [{ code: 10002 }], result: null } },
      { status: 200, body: { success: false, errors: [{ code: 10001 }], result: null } },
      { status: 200, body: { success: true, errors: [], messages: [] } },
    ];

    for (const failureCase of failureCases) {
      const calls = stubFetch(failureCase);

      await expect(
        sendWithCloudflareEmail(renderedEmail, cloudflareEnv)
      ).rejects.toThrow('Cloudflare Email Sending');
      expect(calls).toHaveLength(1);
      restoreFetch?.();
      restoreFetch = null;
    }
  });

  test('treats network failure as terminal without retrying', async () => {
    const calls = stubFetch({ status: 503, throws: true });

    await expect(
      sendWithCloudflareEmail(renderedEmail, cloudflareEnv)
    ).rejects.toThrow('Cloudflare Email Sending request failed');
    expect(calls).toHaveLength(1);
  });
});
