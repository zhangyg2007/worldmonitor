// api/zh/news.js — 中文财经快讯读取端点
// 数据源: zh-collector（Phase A 已上线，写 WM-redis key zh:news:eastmoney:v1 与 seed-meta:zh:eastmoney）
// 契约: REST 模式同 api/product-catalog.js（WM 已用 REDIS_REST_URL / REDIS_TOKEN / REDIS_PASSTHROUGH）
// 兼容两种写入形态：
//   1) 裸 JSON 数组（collector v0.1 实际写出）
//   2) {_seed:{...}, data:[...]} 信封（未来改用 WM 标准 seeder 时）
// 返回: { ok, source, count, totalCount, fetchedAt, state, items[] }

import { getPublicCorsHeaders, isDisallowedOrigin } from '../_cors.js';
import { unwrapEnvelope } from '../_seed-envelope.js';

const KEY = 'zh:news:eastmoney:v1';
const META_KEY = 'seed-meta:zh:eastmoney';
// The compose stack injects the Redis-REST proxy as UPSTASH_REDIS_REST_URL /
// UPSTASH_REDIS_REST_TOKEN (docker-compose.yml), which is also the name
// server/_shared/redis.ts reads. The previous REDIS_REST_URL / REDIS_TOKEN
// names were never present in the runtime env, so every proxied read failed
// open and the endpoint answered with an empty item list.
const REST_URL = process.env.UPSTASH_REDIS_REST_URL ?? 'http://127.0.0.1:8079';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? '';

// The proxy authenticates with a plain Bearer token (docker/redis-rest-proxy.mjs
// checkAuth) — no passthrough header is involved.
const AUTH_HDRS = REST_TOKEN ? { Authorization: `Bearer ${REST_TOKEN}` } : {};

async function _restGet(key) {
  try {
    const res = await fetch(`${REST_URL}/get/${encodeURIComponent(key)}`, {
      headers: AUTH_HDRS,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body || body.result == null) return null;
    return body.result;
  } catch { return null; }
}

/**
 * 归一化为 { items:[], _seed:null|obj }。
 * 兼容三种写入形态：
 *   1) {v, sourceName, fetchedAt, recordCount, state, records:[...]} — 采集器实际写出
 *   2) {_seed:{...}, data:[...]} 信封（WM 标准 seeder）
 *   3) 裸 JSON 数组（collector v0.1）
 */
function _normalizeItems(raw) {
  if (raw == null) return { items: [], _seed: null };
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return { items: [], _seed: null }; }
  }
  if (v && !Array.isArray(v) && typeof v === 'object') {
    // 采集器形态：事件在 records 字段。
    if (Array.isArray(v.records)) {
      const seed = v.state ? {
        fetchedAt: v.fetchedAt,
        recordCount: v.recordCount,
        state: v.state,
        sourceName: v.sourceName,
      } : null;
      return { items: v.records, _seed: seed };
    }
    // 信封形态
    if (v._seed && v.data) {
      return { items: Array.isArray(v.data) ? v.data : [], _seed: v._seed };
    }
  }
  if (Array.isArray(v)) return { items: v, _seed: null };
  return { items: [], _seed: null };
}

/** 从 envelope 字符串（meta 形态）里解析 SeedMeta */
function _parseMeta(raw) {
  if (raw == null) return null;
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (v && typeof v === 'object' && v.state) return v;
  } catch { /* ignore */ }
  return null;
}

// The sidecar dispatches flat api/*.js handlers as `mod.default(request)`
// (src-tauri/sidecar/local-api-server.mjs) with a standard Request, matching
// the other 24 flat handlers (api/product-catalog.js and friends). Exporting
// `onRequest(ctx)` instead made the sidecar reject the module with
// "Invalid handler module" (HTTP 500).
export default async function handler(req) {
  const url = new URL(req.url);
  const cors = getPublicCorsHeaders('GET, DELETE, OPTIONS');
  if (isDisallowedOrigin(req)) {
    return new Response(JSON.stringify({ error: 'disallowed origin' }), { status: 403, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  if (req.method === 'DELETE') {
    try {
      await fetch(REST_URL, {
        method: 'POST',
        headers: { ...AUTH_HDRS, 'Content-Type': 'application/json' },
        body: JSON.stringify(['DEL', KEY, META_KEY]),
        signal: AbortSignal.timeout(3000),
      });
      return new Response(JSON.stringify({ ok: true, purged: [KEY, META_KEY] }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10) || 100, 500);
  const days = Math.max(parseInt(url.searchParams.get('days') ?? '1', 10) || 1, 30);
  const sinceRaw = url.searchParams.get('since');   // YYYY-MM-DD
  const keyword = (url.searchParams.get('keyword') ?? '').trim().toLowerCase();

  const [rawData, rawMeta] = await Promise.all([
    _restGet(KEY),
    _restGet(META_KEY),
  ]);

  const { items: all, _seed } = _normalizeItems(rawData);
  const meta = _parseMeta(rawMeta);
  const seedMeta = _seed ?? meta;

  // 解析发布时间为毫秒。采集器归一化后的字段是 published_at（带 +08:00）；
  // showTime 是东财原始 API 的字段形态，一并兼容。
  const published = (it) => {
    if (!it) return null;
    const ts = it.published_at
      ? Date.parse(it.published_at)
      : (it.showTime ? Date.parse(it.showTime + ' +08:00') : null);
    return ts ? ts : null;
  };

  const sinceTs = sinceRaw
    ? Date.parse(sinceRaw + 'T00:00:00+08:00')
    : Date.now() - days * 86400000;

  let items = all
    .filter(it => it && it.title)
    .map(it => {
      const ts = published(it);
      return {
        // 采集器归一化后的字段：id / body / tickers；code / summary / stocks
        // 是东财原始 API 的形态，一并兼容。
        id: it.id ?? it.code ?? null,
        title: it.title ?? '',
        summary: it.body ?? it.summary ?? '',
        publishedAt: ts ? new Date(ts).toISOString() : null,
        tickers: Array.isArray(it.tickers) ? it.tickers : (Array.isArray(it.stocks) ? it.stocks : []),
        raw: null,
      };
    })
    .filter(it => it.publishedAt == null || Date.parse(it.publishedAt) >= sinceTs);

  if (keyword) {
    items = items.filter(it =>
      it.title.toLowerCase().includes(keyword) || it.summary.toLowerCase().includes(keyword));
  }
  items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  items = items.slice(0, limit);

  const full = url.searchParams.get('full') === '1';
  if (full) {
    items = items.map(it => {
      const hit = all.find(a => a && (a.id ?? a.code ?? null) === it.id && a.title === it.title);
      return { ...it, raw: hit ?? null };
    });
  }

  const body = {
    ok: true,
    source: 'eastmoney',
    count: items.length,
    totalCount: all.length,
    fetchedAt: seedMeta?.fetchedAt ?? Date.now() - 60000,
    state: seedMeta?.state ?? 'OK',
    items,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
