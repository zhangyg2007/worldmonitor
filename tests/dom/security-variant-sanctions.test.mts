// tests/dom/security-variant-sanctions.test.mts
// Task 3: SanctionsFilterBar + 5 套制裁名单 + URL 同步
// 验证:
//   - SANCTIONS_LISTS 5 套, 含 OFAC/EU/UN/UK/MOFCOM
//   - 默认 mount 后无勾选
//   - 勾选 ofac → URL ?lists=ofac
//   - 勾选 ofac+eu → URL ?lists=ofac,eu (任意顺序)
//   - 初始 URL 含 ?lists=ofac,un → mount 后勾选状态还原
//   - mountSecurityPanels 在容器存在时不抛错

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('SanctionsFilterBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="sanctions-filter-container"></div>';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('SANCTIONS_LISTS 含 5 套 + 5 套 ID 正确', async () => {
    const { SANCTIONS_LISTS } = await import('@/config/security-panels');
    expect(SANCTIONS_LISTS.length).toBe(5);
    const ids = SANCTIONS_LISTS.map(s => s.id);
    expect(ids).toContain('ofac');
    expect(ids).toContain('eu');
    expect(ids).toContain('un');
    expect(ids).toContain('uk');
    expect(ids).toContain('mofcom');
  });

  it('默认 mount 后无勾选', async () => {
    const { SanctionsFilterBar } = await import('@/components/SanctionsFilterBar');
    const url = new URLSearchParams('');
    const bar = new SanctionsFilterBar({ containerId: 'sanctions-filter-container' }, url);
    bar.mount();
    const checked = document.querySelectorAll('input[data-sanctions-id]:checked');
    expect(checked.length).toBe(0);
    expect(bar.getSelected().size).toBe(0);
  });

  it('勾选 ofac → URL 包含 lists=ofac', async () => {
    const { SanctionsFilterBar } = await import('@/components/SanctionsFilterBar');
    const url = new URLSearchParams('');
    const bar = new SanctionsFilterBar({ containerId: 'sanctions-filter-container' }, url);
    bar.mount();
    const ofac = document.querySelector('input[data-sanctions-id="ofac"]') as HTMLInputElement;
    ofac.checked = true;
    ofac.dispatchEvent(new Event('change'));
    expect(url.get('lists')).toBe('ofac');
  });

  it('勾选 ofac+eu → URL 包含 lists=ofac,eu (任意顺序)', async () => {
    const { SanctionsFilterBar } = await import('@/components/SanctionsFilterBar');
    const url = new URLSearchParams('');
    const bar = new SanctionsFilterBar({ containerId: 'sanctions-filter-container' }, url);
    bar.mount();
    const ofac = document.querySelector('input[data-sanctions-id="ofac"]') as HTMLInputElement;
    const eu = document.querySelector('input[data-sanctions-id="eu"]') as HTMLInputElement;
    ofac.checked = true; ofac.dispatchEvent(new Event('change'));
    eu.checked = true; eu.dispatchEvent(new Event('change'));
    const lists = (url.get('lists') || '').split(',').sort();
    expect(lists).toEqual(['eu', 'ofac']);
  });

  it('初始 URL ?lists=ofac,un → mount 后勾选状态还原', async () => {
    const { SanctionsFilterBar } = await import('@/components/SanctionsFilterBar');
    const url = new URLSearchParams('?lists=ofac,un');
    const bar = new SanctionsFilterBar({ containerId: 'sanctions-filter-container' }, url);
    bar.mount();
    const ofac = document.querySelector('input[data-sanctions-id="ofac"]') as HTMLInputElement;
    const un = document.querySelector('input[data-sanctions-id="un"]') as HTMLInputElement;
    expect(ofac.checked).toBe(true);
    expect(un.checked).toBe(true);
    const sel = bar.getSelected();
    expect(sel.has('ofac')).toBe(true);
    expect(sel.has('un')).toBe(true);
  });

  it('取消勾选后 URL 删除该 ID', async () => {
    const { SanctionsFilterBar } = await import('@/components/SanctionsFilterBar');
    const url = new URLSearchParams('?lists=ofac,eu');
    const bar = new SanctionsFilterBar({ containerId: 'sanctions-filter-container' }, url);
    bar.mount();
    const ofac = document.querySelector('input[data-sanctions-id="ofac"]') as HTMLInputElement;
    expect(ofac.checked).toBe(true);
    ofac.checked = false;
    ofac.dispatchEvent(new Event('change'));
    expect(url.get('lists')).toBe('eu');
  });

  it('容器缺失时 mount 抛错', async () => {
    document.body.innerHTML = '';
    const { SanctionsFilterBar } = await import('@/components/SanctionsFilterBar');
    const url = new URLSearchParams('');
    const bar = new SanctionsFilterBar({ containerId: 'nonexistent' }, url);
    expect(() => bar.mount()).toThrow();
  });
});
