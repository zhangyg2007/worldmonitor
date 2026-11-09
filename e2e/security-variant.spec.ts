// e2e/security-variant.spec.ts
//
// Product A "security" variant — real-browser wiring verification.
//
// The 2026-10-14 security-variant work shipped three components
// (RiskHeatmapPanel, SanctionsFilterBar, SecuritySidebar) whose unit tests
// all passed while the feature was unreachable in the UI: mountSecurityPanels
// had no caller, the three containers existed in no template, variant-meta
// had no 'security' entry, and the in-app switcher offered no security item.
// Unit tests instantiate the components directly, so they cannot catch any of
// that. This spec drives a real browser against a real deployment and asserts
// the integration points instead.
//
// The hard constraint is that the security facade layers ON TOP of the
// geopolitical product and never narrows it: the six geo-security surfaces
// (military / conflicts / natural / ais / flights / cyberThreats) must all
// still be available. The production-safe way to assert that is to compare the
// rendered layer pickers of the two variants — the registry itself is not
// importable from a built bundle, and the picker is renderer-scoped (the 2D
// and globe renderers expose the SVG/globe-executable subset, cyberThreats
// being deck-only), so comparing pickers is what the user actually gets.

import { expect, test, type Page } from '@playwright/test';

// The full chromium build is used instead of the default headless shell: this
// sandbox has chromium-1208 installed but not chromium_headless_shell, and the
// bundled channel resolves to the same browser with the same engine.
test.use({ channel: 'chromium' });

const SIX_LAYER_IDS = [
  'military',
  'conflicts',
  'natural',
  'ais',
  'flights',
  'cyberThreats',
] as const;

/** Switch the running app to a variant and wait for the layer picker to render. */
async function activateVariant(page: Page, variant: string): Promise<string[]> {
  await page.goto('/');
  await page.evaluate((v) => {
    window.localStorage.setItem('worldmonitor-variant', v);
  }, variant);
  await page.reload();

  // The layer picker is rendered by the map component once it mounts.
  await expect(page.locator('.layer-toggle[data-layer]').first()).toBeVisible({ timeout: 45000 });
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.layer-toggle[data-layer]'))
      .map((el) => el.getAttribute('data-layer') ?? '')
      .filter(Boolean),
  );
}

test.describe('security variant wiring', () => {
  test('the security variant activates and mounts all three components', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('worldmonitor-variant', 'security');
    });
    await page.reload();

    // The layout render emits the three containers; the App boot hook mounts
    // the components into them.
    await expect(page.locator('#security-sidebar-container')).toHaveCount(1);
    await expect(page.locator('#sanctions-filter-container')).toHaveCount(1);
    await expect(page.locator('#risk-heatmap-container')).toHaveCount(1);

    // SecuritySidebar renders one button per view.
    await expect(page.locator('.security-sidebar-item')).toHaveCount(4);

    // SanctionsFilterBar renders one checkbox per sanctions list.
    await expect(page.locator('#sanctions-filter-container input[data-sanctions-id]')).toHaveCount(5);

    // RiskHeatmapPanel renders its demo-data watermark.
    await expect(page.locator('.risk-heatmap-watermark')).toHaveCount(1);

    // The variant is announced on the document element, same as every other
    // variant (index.html's prepaint script reads the stored variant).
    await expect(page.locator('html')).toHaveAttribute('data-variant', 'security');

    // UI evidence for the pull request: the security facade in place.
    await page.screenshot({ path: 'test-results/security-variant/desktop.png', fullPage: false });
  });

  test('the security facade renders on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('worldmonitor-variant', 'security');
    });
    await page.reload();

    await expect(page.locator('.security-sidebar-item')).toHaveCount(4);
    await page.screenshot({ path: 'test-results/security-variant/mobile.png', fullPage: false });
  });

  test('the security variant does not narrow the geopolitical layer catalog', async ({ page }) => {
    const fullLayers = await activateVariant(page, 'full');
    const securityLayers = await activateVariant(page, 'security');

    // The hard constraint: every layer the full dashboard offers must still be
    // offered by the security variant.
    const missing = fullLayers.filter((key) => !securityLayers.includes(key));
    expect(missing, 'the security variant must not remove any map layer').toEqual([]);

    // And the geo-security surfaces must lead the picker — that is the
    // product's primary read. cyberThreats is deck-only, so it is absent from
    // the SVG/globe picker in every variant; the assertion is over the
    // geo-security surfaces the active renderer actually offers.
    const available = SIX_LAYER_IDS.filter((id) => securityLayers.includes(id));
    expect(available.length).toBeGreaterThanOrEqual(5);
    expect(securityLayers.slice(0, available.length)).toEqual(available);
  });

  test('the six geo-security layers stay in the layer registry', async ({ page }) => {
    await page.goto('/');

    // The registry module is only served by the dev server. Against a built
    // bundle this assertion is covered by the picker comparison above.
    const registry = await page.evaluate(async () => {
      try {
        const mod = await import('/src/config/map-layer-definitions.ts');
        return {
          available: true,
          security: mod.getOrderedLayerKeys('security') as string[],
          full: mod.getOrderedLayerKeys('full') as string[],
        };
      } catch {
        return { available: false, security: [] as string[], full: [] as string[] };
      }
    });

    test.skip(!registry.available, 'source modules are not served by a production bundle');

    for (const id of SIX_LAYER_IDS) {
      expect(registry.security, `layer ${id} must remain in the security variant`).toContain(id);
    }
    expect(registry.full.filter((k) => !registry.security.includes(k))).toEqual([]);
  });

  test('the in-app switcher offers the security variant', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('worldmonitor-variant', 'security');
    });
    await page.reload();
    await expect(page.locator('.variant-option[data-variant="security"]')).toHaveCount(1);
  });
});
