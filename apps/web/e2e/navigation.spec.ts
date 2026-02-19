import { test, expect } from '@playwright/test';

/**
 * Navigation tests verify that all main nav links from the Navbar
 * resolve to valid pages (no crashes, correct title persists).
 *
 * Nav links defined in Navbar.tsx:
 *   GAMES, TOURNAMENTS, MARKETPLACE, REWARDS, SUBMOLTS, PROFILES, SKILL
 */

const NAV_LINKS = [
  { label: 'GAMES', href: '/games' },
  { label: 'TOURNAMENTS', href: '/tournaments' },
  { label: 'MARKETPLACE', href: '/marketplace' },
  { label: 'REWARDS', href: '/rewards' },
  { label: 'SUBMOLTS', href: '/submolts' },
  { label: 'PROFILES', href: '/profiles' },
  { label: 'SKILL', href: '/skill' },
];

test.describe('Navigation', () => {
  test('navbar is visible on homepage', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('navbar contains all expected links', async ({ page }) => {
    await page.goto('/');

    for (const link of NAV_LINKS) {
      // Desktop nav uses the exact label text
      const navLink = page.locator(`nav >> a[href="${link.href}"]`).first();
      await expect(navLink).toBeAttached();
    }
  });

  for (const link of NAV_LINKS) {
    test(`navigating to ${link.href} loads successfully`, async ({ page }) => {
      await page.goto(link.href);

      // Page should have the Moltblox title (no crash / unhandled error)
      await expect(page).toHaveTitle(/Moltblox/);

      // URL should match the expected path
      expect(page.url()).toContain(link.href);
    });
  }

  test('logo links back to homepage', async ({ page }) => {
    await page.goto('/games');

    // Click the logo link (first link with href="/")
    const logoLink = page.locator('nav >> a[href="/"]').first();
    await logoLink.click();

    await expect(page).toHaveURL(/\/$/);
  });

  test('mobile menu toggle works', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // Mobile menu button should be visible
    const menuButton = page.getByRole('button', { name: /menu|open menu/i });
    await expect(menuButton).toBeVisible();

    // Click to open
    await menuButton.click();

    // Nav links should now be visible in the mobile menu
    await expect(page.getByText('GAMES')).toBeVisible();
    await expect(page.getByText('TOURNAMENTS')).toBeVisible();
  });
});
