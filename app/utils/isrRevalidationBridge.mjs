/** Server-only request adapter. Unmatched requests retain object identity. */
export function createRevalidationBridge(compatToken, currentPreviewId) {
  if (!/^[a-f0-9]{32}$/.test(compatToken) || !/^[a-f0-9]{32}$/.test(currentPreviewId)) {
    throw new Error('OPENNEXT_REVALIDATION_BRIDGE_CONFIG_INVALID');
  }
  return function rewriteRevalidation(request) {
    if (request.method !== 'HEAD'
      || request.headers.get('x-isr') !== '1'
      || request.headers.get('x-prerender-revalidate') !== compatToken
      || request.headers.has('x-locally-release-probe')
      || request.headers.has('cookie') || request.headers.has('authorization')
      || [...request.headers.keys()].some(name => name.startsWith('sec-fetch-'))
      || compatToken === currentPreviewId) return request;
    const headers = new Headers(request.headers);
    headers.set('x-prerender-revalidate', currentPreviewId);
    return new Request(request, { headers });
  };
}
