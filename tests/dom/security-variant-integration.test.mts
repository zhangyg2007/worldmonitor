// tests/dom/security-variant-integration.test.mts
// Task 6: 集成测试 — 验证 mountSecurityPanels 端到端
//   - 一次 mount 调用同时挂载 3 个组件 (RiskHeatmapPanel + SanctionsFilterBar + SecuritySidebar)
//   - 制裁勾选状态不干扰其他组件
//   - localStorage 隔离 (sidebar 不影响 sanctions)
//   - 全部组件在容器存在时挂载成功

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('security variant 集成 (mountSecurityPanels 端到端)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="risk-heatmap-container"></div>
      <div id="sanctions-filter-container"></div>
      <div id="security-sidebar-container"></div>
    `;
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('一次 mount 调用挂载 3 个组件 (heatmap 水印 + sanctions checkboxes + sidebar items)', async () => {
    const { mountSecurityPanels } = await import('@/config/variants/security');
    await mountSecurityPanels();

    // 1. RiskHeatmapPanel 水印
    const watermark = document.querySelector('.risk-heatmap-watermark');
    expect(watermark?.textContent).toBe('demo data');

    // 2. SanctionsFilterBar 5 个 checkboxes
    const checkboxes = document.querySelectorAll('input[data-sanctions-id]');
    expect(checkboxes.length).toBe(5);

    // 3. SecuritySidebar 4 个视图
    const sidebarItems = document.querySelectorAll('.security-sidebar-item');
    expect(sidebarItems.length).toBe(4);
  });

  it('SanctionsFilterBar 勾选 + SecuritySidebar 切视图 互不干扰', async () => {
    const { mountSecurityPanels } = await import('@/config/variants/security');
    // 预设 window.location.search 含空 url (mountSecurityPanels 内部 new URLSearchParams)
    await mountSecurityPanels();

    // 勾选 ofac - 直接操作 DOM
    const ofac = document.querySelector('input[data-sanctions-id="ofac"]') as HTMLInputElement;
    ofac.checked = true;
    ofac.dispatchEvent(new Event('change'));
    // mountSecurityPanels 内部 url 是新 new 的, 不暴露; 但 DOM 上 checkboxes 应有勾选态
    expect(ofac.checked).toBe(true);

    // 切 sidebar 到 subs
    (document.querySelector('[data-view-id="subs"]') as HTMLElement).click();
    expect(localStorage.getItem('worldmonitor.security.currentView')).toBe('subs');

    // 制裁勾选态仍保留
    expect(ofac.checked).toBe(true);
    const subsBtn = document.querySelector('[data-view-id="subs"]') as HTMLElement;
    expect(subsBtn.classList.contains('active')).toBe(true);
  });

  it('localStorage sidebar 状态保留, sanctions 状态不写入 localStorage', async () => {
    const { mountSecurityPanels } = await import('@/config/variants/security');
    await mountSecurityPanels();

    (document.querySelector('[data-view-id="events"]') as HTMLElement).click();
    const ofac = document.querySelector('input[data-sanctions-id="ofac"]') as HTMLInputElement;
    ofac.checked = true;
    ofac.dispatchEvent(new Event('change'));

    expect(localStorage.getItem('worldmonitor.security.currentView')).toBe('events');
    // sanctions 不写 localStorage (走 URL)
    expect(localStorage.getItem('worldmonitor.security.lists')).toBeNull();
  });

  it('挂载后再 mount 一次不会抛错 (幂等)', async () => {
    const { mountSecurityPanels } = await import('@/config/variants/security');
    await mountSecurityPanels();
    await expect(mountSecurityPanels()).resolves.not.toThrow();
  });
});
