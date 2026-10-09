import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent, buildConnector, fetch as dispatcherFetch } from 'undici';

// Keep fetch and its dispatcher on the same locked Undici implementation. Node
// embeds a different Undici revision; do not mix its fetch body handler with this
// package's experimental H2 dispatcher. No network failure is swallowed/replayed.
// Test-run scoped DNS resolution: do not fan out getaddrinfo once per concurrent
// browser resource. Coalesce authoritative A lookups, respect their shortest TTL,
// and fail on resolver errors. No application-level retry, stale fallback or TLS bypass.
export function createCandidateReadTransport(origin, {
  resolve = hostname => resolve4(hostname, { ttl: true }),
  clock = Date.now, fetchImplementation = dispatcherFetch,
  makeDispatcher = options => new Agent(options),
  makeConnector = options => buildConnector(options),
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
  // Negotiate the origin's HTTP/2 support rather than forcing browser traffic
  // through fresh HTTP/1.1 connections. Bound H2 streams to the existing read
  // concurrency. H1 still disables idle reuse; neither protocol replays errors.
  // TLS/hostname verification and each caller's original deadline stay intact.
  const sockets = new Map(), connector = makeConnector({ lookup, allowH2: true });
  const connect = (options, callback) => connector(options, (error, socket) => {
    if (socket) {
      const closed = new Promise(resolve => socket.once('close', resolve));
      sockets.set(socket, closed);
      socket.once('close', () => sockets.delete(socket));
    }
    callback(error, socket);
  });
  const dispatcher = makeDispatcher({ connections: 8, pipelining: 0, allowH2: true,
    maxConcurrentStreams: 8, connect });
  return {
    fetch: (url, options = {}) => {
      if (closed) throw new Error('Candidate transport closed');
      if (new URL(url).origin !== expected.origin || !['GET', 'HEAD', 'OPTIONS'].includes((options.method ?? 'GET').toUpperCase())) {
        throw new Error('Candidate transport read scope violation');
      }
      return fetchImplementation(url, { ...options, dispatcher });
    },
    // Scope teardown must also dispose reset H2 sessions. Graceful close can wait
    // forever for a peer that kept a failed stream's session open. This is only
    // explicit cleanup; active request failures remain rejected and unreplayed.
    close: async () => {
      closed = true;
      // A failed socket can reject fetch before its close callbacks run. Let
      // that exact lifecycle complete before disposing its client; otherwise
      // Undici H2 cleanup can race its pending-index reset. No sleeps/retries.
      await Promise.all([...sockets].filter(([socket]) => socket.destroyed)
        .map(([, completion]) => completion));
      await dispatcher.destroy();
    },
    receipts: () => structuredClone(receipts),
  };
}
