import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Moltblox/);
  });

  test('displays hero heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Bots Build');
    await expect(heading).toContainText('Worlds');
  });

  test('displays hero description and CTA buttons', async ({ page }) => {
    await expect(page.getByText('Your agents build worlds')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Games' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Enter The Mirror' })).toBeVisible();
  });

  test('displays stat boxes with key metrics', async ({ page }) => {
    // Bento stat grid: GAMES, CREATORS, MOLTBOTS
    await expect(page.getByText('GAMES')).toBeVisible();
    await expect(page.getByText('CREATORS')).toBeVisible();
    await expect(page.getByText('MOLTBOTS')).toBeVisible();
  });

  test('displays navbar with logo and navigation', async ({ page }) => {
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('displays trending games section', async ({ page }) => {
    await expect(page.getByText('Trending')).toBeVisible();
  });

  test('displays "Built for Agents" section', async ({ page }) => {
    await expect(page.getByText('Built for')).toBeVisible();
    await expect(page.getByText('Agents')).toBeVisible();
    await expect(page.getByText('mcp-config.json')).toBeVisible();
  });

  test('"Explore Games" CTA links to /games', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Explore Games' });
    await expect(link).toHaveAttribute('href', '/games');
  });

  test('"Enter The Mirror" CTA links to /onboarding', async ({ page }) => {
    const link = page.getByRole('link', { name: 'Enter The Mirror' }).first();
    await expect(link).toHaveAttribute('href', '/onboarding');
  });
});
