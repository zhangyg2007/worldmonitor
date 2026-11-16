// tests/dom/setup-network-guard.mts
//
// Network guard for the DOM unit suite.
//
// A unit test must never reach the public internet. Two reasons, and the
// second one is specific to this host:
//
//   1. A test that calls a real endpoint is not a unit test; it is a
//      network-dependent integration test whose result depends on the
//      machine it runs on.
//
//   2. On a network with DNS poisoning (this host), a blocked hostname
//      resolves to an unrelated IP — e.g. maps.worldmonitor.app resolved to
//      Facebook's AS32934 addresses — so the fetch does not fail fast, it
//      HANGS until the connect timeout, and the DNS answer itself is
//      attacker-controlled. That is both a slow suite and a real (if
//      low-severity) risk: the response would come from whatever host owns
//      the poisoned address.
//
// The guard therefore blocks every absolute-URL request to a non-loopback
// host BEFORE the request leaves the process, so no DNS lookup happens at
// all. Blocked calls are recorded and reported after the file finishes, so a
// test that reaches for the network is visible instead of silently slow.
//
// Loopback and relative URLs are left alone: a relative URL resolves
// against the page origin, which in happy-dom is http://localhost:3000 —
// the local deployment, not the internet. Tests that want the local stack
// should stub it (see tests/dom/security-variant-country-risk.test.mts).

import { afterAll, beforeAll } from 'vitest';

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const blocked: string[] = [];

function hostOf(url: string): string | null {
  try {
    const parsed = new URL(url, 'http://localhost');
    // A relative URL inherits the page origin (localhost) — not an external host.
    if (!/^https?:\/\//i.test(url)) return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

let originalFetch: typeof globalThis.fetch;

beforeAll(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === 'string'
      ? input
      : (input instanceof URL ? input.toString() : input?.url ?? '');
    const host = hostOf(raw);
    if (host && !ALLOWED_HOSTS.has(host)) {
      blocked.push(raw);
      throw new Error(
        `[network-guard] blocked external request to ${host} (${raw}). ` +
        'Unit tests must not reach the internet — stub the dependency instead.',
      );
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  if (blocked.length > 0) {
    const unique = [...new Set(blocked)];
    // eslint-disable-next-line no-console
    console.warn(
      `[network-guard] blocked ${blocked.length} external request(s) in this file:\n` +
      unique.map((u) => `  - ${u}`).join('\n'),
    );
  }
});
