import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent } from 'undici';

// Test-run scoped DNS resolution: do not fan out getaddrinfo once per concurrent
// browser resource. Coalesce authoritative A lookups, respect their shortest TTL,
// and fail on resolver errors. No application-level retry, stale fallback or TLS bypass.
export function createCandidateReadTransport(origin, {
  resolve = hostname => resolve4(hostname, { ttl: true }),
  clock = Date.now, fetchImplementation = fetch,
  makeDispatcher = options => new Agent(options),
} = {}) {
  const expected = new URL(origin), host = expected.hostname;
  let entry, pending, closed = false;
  const receipts = [];
  const lookup = (hostname, options, callback) => {
    if (closed || hostname !== host) { callback(Object.assign(new Error('Candidate DNS scope violation'), { code: 'ERR_CANDIDATE_DNS_SCOPE' })); return; }
    if (isIP(host)) { callback(null, options?.all ? [{ address: host, family: isIP(host) }] : host, isIP(host)); return; }
    if (!entry || clock() >= entry.expires) {
      pending ??= (async () => {
        const began = clock(), records = await resolve(host);
        if (!records.length || records.some(r => isIP(r.address) !== 4 || !Number.isFinite(r.ttl) || r.ttl <= 0)) {
          throw Object.assign(new Error('Invalid candidate DNS answer'), { code: 'ERR_CANDIDATE_DNS_ANSWER' });
        }
        const expires = began + Math.min(...records.map(r => r.ttl)) * 1000;
        if (expires <= clock()) throw Object.assign(new Error('Expired candidate DNS answer'), { code: 'ERR_CANDIDATE_DNS_EXPIRED' });
        entry = { records: records.map(({ address }) => ({ address, family: 4 })), expires };
        receipts.push({ hostname: host, status: 'resolved', addresses: entry.records, ttlMs: expires - began });
        return entry;
      })().finally(() => { pending = null; });
    }
    const ready = pending ?? Promise.resolve(entry);
    ready.then(row => {
      if (options?.family === 6) throw Object.assign(new Error('No IPv6 candidate DNS answer'), { code: 'ENODATA' });
      callback(null, options?.all ? row.records : row.records[0].address, 4);
    }).catch(error => { receipts.push({ hostname: host, status: 'failed', code: error.code ?? 'DNS_ERROR' }); callback(error); });
  };
  // Close after each read: an idle peer-close race must not silently replay a
  // candidate request. Fresh sockets retain hostname/TLS verification.
  const dispatcher = makeDispatcher({ connections: 8, pipelining: 0, connect: { lookup } });
  return {
    fetch: (url, options = {}) => {
      if (closed) throw new Error('Candidate transport closed');
      if (new URL(url).origin !== expected.origin || !['GET', 'HEAD', 'OPTIONS'].includes((options.method ?? 'GET').toUpperCase())) {
        throw new Error('Candidate transport read scope violation');
      }
      return fetchImplementation(url, { ...options, dispatcher });
    },
    close: async () => { closed = true; await dispatcher.close(); },
    receipts: () => structuredClone(receipts),
  };
}
