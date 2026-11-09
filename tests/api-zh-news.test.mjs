// tests/api-zh-news.test.mjs
//
// Regression cover for the custom Chinese-market-news endpoint
// (api/zh/news.js).
//
// The endpoint shipped in the 2026-10-14 security-variant work and was never
// reachable: the sidecar dispatches flat api/*.js handlers as
// `mod.default(request)` and rejects a module without a default export with
// "Invalid handler module" (HTTP 500). On top of that it read REDIS_REST_URL /
// REDIS_TOKEN, which the compose stack never injects (it injects
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN), and its normalizer only
// understood a bare array or a {_seed,data} envelope, while the zh-collector
// writes {v, sourceName, fetchedAt, recordCount, state, records:[...]}.
//
// These tests pin the handler contract, the envelope shapes, and the field
// mapping so the next refactor cannot silently re-break the endpoint.

import test from 'node:test';
import assert from 'node:assert/strict';

const MODULE_URL = new URL('../api/zh/news.js', import.meta.url).href;

/**
 * Load the handler with a stubbed Redis-REST proxy and run the assertions
 * while the stub is still installed — the handler reads its env and uses
 * global fetch at call time, so the stub has to outlive the assertions.
 */
async function withHandler(run, { result = null, env = {} } = {}) {
  const saved = {};
  for (const [key, value] of Object.entries(env)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ result }),
    };
  };

  try {
    // Fresh module instance per call so the env is read at import time.
    const mod = await import(`${MODULE_URL}?t=${Math.random()}`);
    return await run(mod.default, calls);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function request(url, init = {}) {
  return new Request(url, init);
}

test('the module exposes a default handler the sidecar can dispatch', async () => {
  await withHandler(async (handler) => {
    assert.equal(typeof handler, 'function', 'api/zh/news.js must export a default function');
  });
});

test('reads the collector envelope and maps the item fields', async () => {
  const envelope = {
    v: 1,
    sourceName: 'eastmoney',
    fetchedAt: 1794192245000,
    recordCount: 1,
    state: 'OK',
    records: [
      {
        id: '202611093926061614',
        title: '光纤概念震荡反弹 长盈通涨超10%',
        body: '光纤概念盘中震荡反弹，长盈通涨超10%。',
        url: null,
        author: '',
        published_at: '2026-11-09 10:44:05 +08:00',
        tickers: ['1.688143'],
        tags: [],
      },
    ],
  };

  await withHandler(async (handler, calls) => {
    const res = await handler(request('http://localhost/api/zh/news?limit=5'));
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.source, 'eastmoney');
    assert.equal(body.count, 1);
    assert.equal(body.totalCount, 1);
    assert.equal(body.state, 'OK');

    const item = body.items[0];
    assert.equal(item.id, '202611093926061614');
    assert.equal(item.title, '光纤概念震荡反弹 长盈通涨超10%');
    assert.equal(item.summary, '光纤概念盘中震荡反弹，长盈通涨超10%。');
    assert.deepEqual(item.tickers, ['1.688143']);
    assert.equal(item.publishedAt, '2026-11-09T02:44:05.000Z');

    // The proxy is addressed with the compose-injected variable names and
    // authenticated with a plain Bearer token.
    assert.ok(
      calls.some((c) => c.url.includes('/get/zh%3Anews%3Aeastmoney%3Av1')),
      'the handler must read the collector data key through the Redis-REST proxy',
    );
    const authed = calls.find((c) => c.init?.headers?.Authorization);
    assert.equal(authed?.init?.headers?.Authorization, 'Bearer token-under-test');
  }, {
    result: JSON.stringify(envelope),
    env: {
      UPSTASH_REDIS_REST_URL: 'http://127.0.0.1:8079',
      UPSTASH_REDIS_REST_TOKEN: 'token-under-test',
    },
  });
});

test('still understands the {_seed,data} envelope and a bare array', async () => {
  await withHandler(async (handler) => {
    const body = await (await handler(request('http://localhost/api/zh/news'))).json();
    assert.equal(body.count, 1);
    assert.equal(body.items[0].title, '种子');
  }, {
    result: JSON.stringify({ _seed: { state: 'OK', fetchedAt: 1794192245000 }, data: [{ id: '1', title: '种子' }] }),
  });

  await withHandler(async (handler) => {
    const body = await (await handler(request('http://localhost/api/zh/news'))).json();
    assert.equal(body.count, 1);
    assert.equal(body.items[0].title, '裸数组');
  }, { result: JSON.stringify([{ id: '2', title: '裸数组' }]) });
});

test('applies the keyword and limit filters', async () => {
  // Timestamps are relative to now so the default 1-day window cannot
  // exclude them when the test runs at an arbitrary clock.
  const recent = new Date(Date.now() - 60_000).toISOString();
  const envelope = {
    records: [
      { id: '1', title: '光纤概念反弹', body: 'x', published_at: recent },
      { id: '2', title: '黄金走强', body: 'y', published_at: recent },
    ],
    state: 'OK',
  };

  await withHandler(async (handler) => {
    const filtered = await (await handler(request('http://localhost/api/zh/news?keyword=%E5%85%89%E7%BA%A4'))).json();
    assert.equal(filtered.count, 1);
    assert.match(filtered.items[0].title, /光纤/);

    const limited = await (await handler(request('http://localhost/api/zh/news?limit=1'))).json();
    assert.equal(limited.count, 1);
  }, { result: JSON.stringify(envelope) });
});

test('rejects a disallowed origin and answers OPTIONS', async () => {
  await withHandler(async (handler) => {
    const forbidden = await handler(request('http://localhost/api/zh/news', {
      headers: { origin: 'http://evil.example' },
    }));
    assert.equal(forbidden.status, 403);

    const preflight = await handler(request('http://localhost/api/zh/news', { method: 'OPTIONS' }));
    assert.equal(preflight.status, 204);
  });
});

test('rejects a method that is not GET, DELETE, or OPTIONS', async () => {
  await withHandler(async (handler) => {
    const res = await handler(request('http://localhost/api/zh/news', { method: 'POST' }));
    assert.equal(res.status, 405);
  });
});
