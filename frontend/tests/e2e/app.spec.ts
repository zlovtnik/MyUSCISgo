import { test, expect } from '@playwright/test';

test.describe('WASM App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the application and display the form', async ({ page }) => {
    // Check if the main heading is visible
    await expect(page.locator('h1')).toContainText('USCIS Credential Processor');

    // Check if form elements are present
    await expect(page.locator('input[id="client-id"]')).toBeVisible();
    await expect(page.locator('input[id="client-secret"]')).toBeVisible();
    await expect(page.locator('select[id="environment-select"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show loading state when WASM is initializing', async ({ page }) => {
    // Check for WASM loading message
    await expect(page.locator('text=Loading WASM module')).toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    // Wait for WASM to load (button should be disabled initially)
    await page.waitForSelector('button[type="submit"][disabled]', { timeout: 5000 });

    // Fill in valid data first to enable the button
    await page.fill('input[id="client-id"]', 'test-client');
    await page.fill('input[id="client-secret"]', 'password123');
    await page.selectOption('select[id="environment-select"]', 'development');

    // Wait for button to be enabled
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 });

    // Clear the form to test validation
    await page.fill('input[id="client-id"]', '');
    await page.fill('input[id="client-secret"]', '');

    // Button should be disabled again
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should accept valid credentials and show results', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 });

    // Fill out the form with valid data
    await page.fill('input[id="client-id"]', 'test-client-123');
    await page.fill('input[id="client-secret"]', 'MySecurePass123');
    await page.selectOption('select[id="environment-select"]', 'development');

    // Submit the form
    await page.click('button[type="submit"]');

    // Check for loading state
    await expect(page.locator('button[type="submit"]')).toContainText('Processing...');

    // Wait for results (this might take a moment due to WASM processing)
    await page.waitForSelector('.result', { timeout: 20000 });

    // Verify results are displayed
    await expect(page.locator('.result')).toBeVisible();
    await expect(page.locator('.result')).toContainText('Result:');
  });

  test('should handle different environments', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 });

    // Test development environment
    await page.fill('input[id="client-id"]', 'test-client-dev');
    await page.fill('input[id="client-secret"]', 'DevPass123');
    await page.selectOption('select[id="environment-select"]', 'development');
    await page.click('button[type="submit"]');

    await page.waitForSelector('.result', { timeout: 20000 });
    await expect(page.locator('.result')).toContainText('localhost:8080');

    // Clear and test staging environment
    await page.reload();
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 });

    await page.fill('input[id="client-id"]', 'test-client-staging');
    await page.fill('input[id="client-secret"]', 'StagingPass123');
    await page.selectOption('select[id="environment-select"]', 'staging');
    await page.click('button[type="submit"]');

    await page.waitForSelector('.result', { timeout: 20000 });
    await expect(page.locator('.result')).toContainText('staging.example.com');
  });

  test('should handle invalid credentials gracefully', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 });

    // Submit invalid credentials
    await page.fill('input[id="client-id"]', 'invalid@client');
    await page.fill('input[id="client-secret"]', 'short');
    await page.selectOption('select[id="environment-select"]', 'development');
    await page.click('button[type="submit"]');

    // Check for error message or that the form handles it gracefully
    // The app should either show an error or handle it without crashing
    await page.waitForTimeout(2000); // Wait a bit for processing

    // Check that we're not stuck in a loading state indefinitely
    const buttonText = await page.locator('button[type="submit"]').textContent();
    expect(buttonText).not.toContain('Processing...');
  });

  test('should clear sensitive data after submission', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 });

    // Fill and submit form
    await page.fill('input[id="client-id"]', 'test-client-123');
    await page.fill('input[id="client-secret"]', 'MySecurePass123');
    await page.selectOption('select[id="environment-select"]', 'development');
    await page.click('button[type="submit"]');

    // Wait for processing to complete
    await page.waitForSelector('.result', { timeout: 20000 });

    // Check that client secret is cleared
    await expect(page.locator('input[id="client-secret"]')).toHaveValue('');
    // Client ID should still be there
    await expect(page.locator('input[id="client-id"]')).toHaveValue('test-client-123');
  });

  test('should be responsive on mobile', async ({ page, isMobile }) => {
    if (isMobile) {
      // Check that the main content is visible on mobile
      await expect(page.locator('h1')).toBeVisible();

      // Check that the form container is present
      await expect(page.locator('form')).toBeVisible();

      // Basic mobile functionality check
      const viewport = page.viewportSize();
      expect(viewport).toBeTruthy();
      expect(viewport!.width).toBeLessThan(768); // Mobile breakpoint
    }
  });
});
