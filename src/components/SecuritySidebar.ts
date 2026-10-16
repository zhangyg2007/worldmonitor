// SecuritySidebar: A 左侧导航 4 视图
// 视图: 热力台 / 事件流 / 制裁名单 / 我的订阅
// 记忆: localStorage (worldmonitor.security.currentView)

export type SecurityView = 'heat' | 'events' | 'sanctions' | 'subs';

const STORAGE_KEY = 'worldmonitor.security.currentView';

const VIEWS: { id: SecurityView; label: string; icon: string }[] = [
  { id: 'heat',      label: '全球风险热力', icon: '🗺️' },
  { id: 'events',    label: '事件流',       icon: '📰' },
  { id: 'sanctions', label: '制裁名单',     icon: '⚖️' },
  { id: 'subs',      label: '我的订阅',     icon: '🔔' },
];

const VALID_VIEWS = new Set<SecurityView>(VIEWS.map(v => v.id));

export interface SecuritySidebarOptions {
  containerId: string;
  onChange?: (view: SecurityView) => void;
  initialView?: SecurityView;
}

export class SecuritySidebar {
  private current: SecurityView;

  constructor(private opts: SecuritySidebarOptions) {
    if (opts.initialView && VALID_VIEWS.has(opts.initialView)) {
      this.current = opts.initialView;
    } else {
      const stored = (typeof localStorage !== 'undefined'
        ? localStorage.getItem(STORAGE_KEY)
        : null) as SecurityView | null;
      this.current = stored && VALID_VIEWS.has(stored) ? stored : 'heat';
    }
  }

  mount(): void {
    const container = document.getElementById(this.opts.containerId);
    if (!container) {
      throw new Error(`Container ${this.opts.containerId} not found`);
    }
    container.className = 'security-sidebar';
    container.innerHTML = '';

    for (const v of VIEWS) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'security-sidebar-item';
      item.dataset.viewId = v.id;
      item.style.cssText =
        'display:block;width:100%;padding:8px 12px;text-align:left;border:0;' +
        'background:transparent;cursor:pointer;border-radius:4px;margin-bottom:2px;';
      item.innerHTML =
        `<span class="icon" style="margin-right:8px;">${v.icon}</span>` +
        `<span class="label">${v.label}</span>`;

      if (v.id === this.current) item.classList.add('active');

      item.addEventListener('click', () => {
        this.current = v.id;
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, this.current);
        }
        container
          .querySelectorAll('.security-sidebar-item')
          .forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        this.opts.onChange?.(this.current);
      });
      container.appendChild(item);
    }
  }

  getCurrent(): SecurityView {
    return this.current;
  }
}
