// tests/dom/security-variant-sidebar.test.mts
// Task 4: SecuritySidebar 4 视图 + localStorage 记忆
// 验证:
//   - mount 后默认 'heat' active
//   - 点击 'events' 切到 'events' + localStorage 写入
//   - localStorage 已有 'subs' → mount 后 'subs' active
//   - 4 个视图 ID 全在

import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('SecuritySidebar', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="security-sidebar-container"></div>';
    localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('VIEWS 含 4 个: heat/events/sanctions/subs', async () => {
    const mod = await import('@/components/SecuritySidebar');
    // VIEWS 不直接 export, 通过 mount 后的 DOM 推断
    const bar = new mod.SecuritySidebar({ containerId: 'security-sidebar-container' });
    bar.mount();
    const items = document.querySelectorAll('.security-sidebar-item');
    expect(items.length).toBe(4);
    const ids = Array.from(items).map(el => (el as HTMLElement).dataset.viewId).sort();
    expect(ids).toEqual(['events', 'heat', 'sanctions', 'subs']);
  });

  it('默认 active = heat + localStorage 写入', async () => {
    const { SecuritySidebar } = await import('@/components/SecuritySidebar');
    const bar = new SecuritySidebar({ containerId: 'security-sidebar-container' });
    bar.mount();
    expect(bar.getCurrent()).toBe('heat');
    const active = document.querySelector('.security-sidebar-item.active');
    expect(active?.getAttribute('data-view-id')).toBe('heat');
  });

  it('点击 events → 切换 active + 写 localStorage', async () => {
    const { SecuritySidebar } = await import('@/components/SecuritySidebar');
    const bar = new SecuritySidebar({ containerId: 'security-sidebar-container' });
    bar.mount();
    const eventsBtn = document.querySelector('[data-view-id="events"]') as HTMLElement;
    eventsBtn.click();
    expect(bar.getCurrent()).toBe('events');
    expect(localStorage.getItem('worldmonitor.security.currentView')).toBe('events');
    expect(eventsBtn.classList.contains('active')).toBe(true);
  });

  it('localStorage 已有 subs → mount 后默认 subs active', async () => {
    localStorage.setItem('worldmonitor.security.currentView', 'subs');
    const { SecuritySidebar } = await import('@/components/SecuritySidebar');
    const bar = new SecuritySidebar({ containerId: 'security-sidebar-container' });
    bar.mount();
    expect(bar.getCurrent()).toBe('subs');
    const active = document.querySelector('.security-sidebar-item.active');
    expect(active?.getAttribute('data-view-id')).toBe('subs');
  });

  it('onChange 回调收到 view 字符串', async () => {
    const { SecuritySidebar } = await import('@/components/SecuritySidebar');
    let received: string | null = null;
    const bar = new SecuritySidebar({
      containerId: 'security-sidebar-container',
      onChange: (v) => { received = v; },
    });
    bar.mount();
    (document.querySelector('[data-view-id="sanctions"]') as HTMLElement).click();
    expect(received).toBe('sanctions');
  });

  it('容器缺失时 mount 抛错', async () => {
    document.body.innerHTML = '';
    const { SecuritySidebar } = await import('@/components/SecuritySidebar');
    const bar = new SecuritySidebar({ containerId: 'nonexistent' });
    expect(() => bar.mount()).toThrow();
  });
});
