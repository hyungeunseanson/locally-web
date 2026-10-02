const VERSION_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

/** Add public version identity only to explicit, read-only release probes. */
export function withReleaseProbeIdentity(request, response, metadata) {
  if (!['GET', 'HEAD'].includes(request.method)
    || request.headers.get('X-Locally-Release-Probe') !== '1'
    || !VERSION_ID.test(metadata?.id ?? '')) return response;
  const headers = new Headers(response.headers);
  headers.set('X-Locally-Worker-Version', metadata.id);
  return new Response(response.body, {
    status: response.status, statusText: response.statusText, headers,
  });
}
