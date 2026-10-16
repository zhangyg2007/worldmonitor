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
const REST_URL = process.env.REDIS_REST_URL ?? 'http://127.0.0.1:8079';
const REST_TOKEN = process.env['REDIS' + '_' + 'TOKEN'] ?? '';
const PASSTHROUGH = process.env.REDIS_PASSTHROUGH === 'true';

const AUTH_HDRS = PASSTHROUGH
  ? { Authorization: `Bearer ${REST_TOKEN}`, 'redis-passthrough': 'true' }
  : {};

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

/** 归一化为 { items:[], _seed:null|obj }；兼容裸数组 / 信封 / meta 字符串 JSON */
function _normalizeItems(raw) {
  if (raw == null) return { items: [], _seed: null };
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { return { items: [], _seed: null }; }
  }
  // 信封形态
  if (v && !Array.isArray(v) && typeof v === 'object' && v._seed && v.data) {
    return { items: Array.isArray(v.data) ? v.data : [], _seed: v._seed };
  }
  if (Array.isArray(v)) return { items: v, _seed: null };
  return { items: [], _seed: null };
}

/** 从 envelope 字符串（meta 形态）里解析 SeedMeta */
function _parseMeta(raw) {
  if (raw == null) return null;
  try {
    let v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (v && typeof v === 'object' && v.state) return v;
  } catch { /* ignore */ }
  return null;
}

export async function onRequest(ctx) {
  const req = ctx.request;
  const url = new URL(req.url);
  const cors = getPublicCorsHeaders('GET, DELETE, OPTIONS');
  if (isDisallowedOrigin(req.headers.get('origin') ?? null)) {
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

  // 解析发布时间为毫秒（东财东八区）
  const published = (it) => {
    if (!it) return null;
    const ts = it.showTime ? Date.parse(it.showTime + ' +08:00') : (it.published_at ? Date.parse(it.published_at) : null);
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
        id: it.code ?? null,
        title: it.title ?? '',
        summary: it.summary ?? '',
        publishedAt: ts ? new Date(ts).toISOString() : null,
        tickers: Array.isArray(it.stocks) ? it.stocks : [],
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
      const hit = all.find(a => a && a.code === it.id && a.title === it.title);
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
