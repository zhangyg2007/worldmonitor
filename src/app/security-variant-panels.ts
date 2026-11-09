// Security variant facade mounting.
//
// Lives in app/ rather than config/ on purpose: the import direction is
// types → config → services → components → app, so config/ may not reach
// into components/. The three security components are UI, so the orchestration
// that instantiates them belongs to the app layer. config/variants/security.ts
// keeps the variant declaration and metadata only.
//
// The containers this mounts are emitted by the panel layout render
// (src/app/panel-layout.ts) for SITE_VARIANT === 'security', so mounting has
// to happen after panelLayout.init().

export async function mountSecurityPanels(): Promise<void> {
  // Accumulates mounts (see the component contracts in the security variant
  // spec): risk heatmap overlay → sanctions list filter bar → left view rail.
  await import('@/components/RiskHeatmapPanel')
    .then(({ RiskHeatmapPanel }) => {
      const heatmap = new RiskHeatmapPanel({
        containerId: 'risk-heatmap-container',
        center: [39.9042, 116.4074],
        zoom: 2.5,
      });
      return heatmap.mount();
    })
    .then(() =>
      import('@/components/SanctionsFilterBar').then(({ SanctionsFilterBar }) => {
        const url = new URLSearchParams(window.location.search);
        const filter = new SanctionsFilterBar(
          {
            containerId: 'sanctions-filter-container',
            onChange: (sel) => {
              // 后续 W4-W6: 触发 country-risk 重算 (含制裁命中数)
              // eslint-disable-next-line no-console
              console.log('sanctions selected:', Array.from(sel).join(','));
            },
          },
          url,
        );
        filter.mount();
      }),
    )
    .then(() =>
      import('@/components/SecuritySidebar').then(({ SecuritySidebar }) => {
        const sidebar = new SecuritySidebar({
          containerId: 'security-sidebar-container',
          onChange: (view) => {
            // 后续: 根据视图切换主页内容
            // eslint-disable-next-line no-console
            console.log('view changed:', view);
          },
        });
        sidebar.mount();
      }),
    );
}
