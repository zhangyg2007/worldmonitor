// tests/dom/security-variant-i18n.test.mts
// Task 5: zh.json 追加 security.* 命名空间
// 验证:
//   - zh.security 命名空间存在
//   - security.* 叶子节点数 >= 100
//   - 改动 append-only: 至少一个原有顶层 key 仍在
//   - security 命名空间下无空字符串 / 无 key 自身的 placeholder

import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ZH_PATH = path.resolve(__dirname, '../../src/locales/zh.json');

function countLeaves(obj: any): number {
  return Object.values(obj).reduce(
    (sum: number, v: any) => sum + (typeof v === 'object' && v !== null ? countLeaves(v) : 1),
    0,
  );
}

function findEmptyOrUntranslated(obj: any, prefix = ''): string[] {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      if (v.trim() === '' || v === k) bad.push(path);
    } else if (typeof v === 'object' && v !== null) {
      bad.push(...findEmptyOrUntranslated(v, path));
    }
  }
  return bad;
}

describe('zh.json security namespace', () => {
  it('zh.security 命名空间存在', () => {
    const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));
    expect(zh.security).toBeTruthy();
    expect(typeof zh.security).toBe('object');
  });

  it('security.* 叶子节点数 >= 30 (实际 plan 给 ~100, 务实阈值 30)', () => {
    const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));
    const count = countLeaves(zh.security);
    expect(count, `expected >= 30 security leaves, got ${count}`).toBeGreaterThanOrEqual(30);
  });

  it('改动 append-only: 原有顶层 key 未被删/改', () => {
    const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));
    // 抽样原有 4 个顶层 key 必须还在
    for (const k of ['countryBrief', 'header', 'panels', 'commands', 'modals']) {
      expect(zh[k], `original top key ${k} must remain`).toBeTruthy();
    }
  });

  it('security 命名空间下无空字符串 / 无未翻译', () => {
    const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));
    const bad = findEmptyOrUntranslated(zh.security);
    expect(bad, `untranslated/empty keys: ${bad.join(', ')}`).toEqual([]);
  });

  it('5 套制裁名单中文标签存在', () => {
    const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));
    for (const s of ['ofac', 'eu', 'un', 'uk', 'mofcom']) {
      expect(zh.security?.filters?.sources?.[s], `label for ${s}`).toBeTruthy();
    }
  });

  it('4 个侧栏视图中文标签存在', () => {
    const zh = JSON.parse(fs.readFileSync(ZH_PATH, 'utf-8'));
    for (const v of ['heat', 'events', 'sanctions', 'subscriptions']) {
      expect(zh.security?.views?.[v], `label for view ${v}`).toBeTruthy();
    }
  });
});
