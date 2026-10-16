// SanctionsFilterBar: 5 套制裁名单筛选器
// 行为: 勾选 → URL ?lists=ofac,eu → 触发 country-risk 重算 (Task 6 接)
// 首阶段: 仅 UI + URL 同步; 真后端 W4-W6

import { SANCTIONS_LISTS, type SanctionsSource } from '@/config/security-panels';

export interface SanctionsFilterBarOptions {
  containerId: string;
  onChange?: (selected: Set<SanctionsSource>) => void;
}

export class SanctionsFilterBar {
  private selected: Set<SanctionsSource> = new Set();

  constructor(
    private opts: SanctionsFilterBarOptions,
    private url: URLSearchParams,
  ) {
    this.selected = this.parseFromUrl();
  }

  mount(): void {
    const container = document.getElementById(this.opts.containerId);
    if (!container) {
      throw new Error(`Container ${this.opts.containerId} not found`);
    }

    container.innerHTML = '';
    container.className = 'sanctions-filter-bar';
    for (const list of SANCTIONS_LISTS) {
      const label = document.createElement('label');
      label.className = 'sanctions-checkbox-label';
      label.style.cssText =
        'display:inline-flex;align-items:center;margin-right:12px;cursor:pointer;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.sanctionsId = list.id;
      checkbox.checked = this.selected.has(list.id);
      checkbox.style.marginRight = '4px';

      const name = document.createElement('span');
      name.className = 'sanctions-list-name';
      name.textContent = list.labelZh;
      name.style.color = list.color;
      name.style.fontWeight = '500';

      const count = document.createElement('span');
      count.className = 'sanctions-list-count';
      count.textContent = ` ${list.count}`;
      count.style.color = '#888';
      count.style.fontSize = '11px';
      count.style.marginLeft = '4px';

      label.appendChild(checkbox);
      label.appendChild(name);
      label.appendChild(count);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) this.selected.add(list.id);
        else this.selected.delete(list.id);
        this.syncUrl();
        this.opts.onChange?.(this.selected);
      });
      container.appendChild(label);
    }
  }

  private parseFromUrl(): Set<SanctionsSource> {
    const raw = this.url.get('lists') || '';
    return new Set(
      raw.split(',')
        .map(s => s.trim())
        .filter((s): s is SanctionsSource =>
          SANCTIONS_LISTS.some(l => l.id === s),
        ),
    );
  }

  private syncUrl(): void {
    if (this.selected.size === 0) {
      this.url.delete('lists');
    } else {
      this.url.set('lists', Array.from(this.selected).join(','));
    }
  }

  getSelected(): Set<SanctionsSource> {
    return new Set(this.selected);
  }
}
