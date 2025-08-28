import { test, expect } from '@playwright/test';

test.describe('WASM App E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have accessible form controls', async ({ page }) => {
    // Check that form fields are accessible via labels
    const clientIdInput = page.getByLabel('Client ID');
    await expect(clientIdInput).toBeVisible();
    await expect(clientIdInput).toHaveAttribute('id', 'client-id');

    const clientSecretInput = page.getByLabel('Client Secret');
    await expect(clientSecretInput).toBeVisible();
    await expect(clientSecretInput).toHaveAttribute('id', 'client-secret');

    const environmentSelect = page.getByLabel('Environment');
    await expect(environmentSelect).toBeVisible();
    await expect(environmentSelect).toHaveAttribute('id', 'environment-select');
  });

  test('should show loading state when processing', async ({ page }) => {
    // Wait for WASM to load and form to be ready
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

    // Fill out the form with valid data
    await page.getByLabel('Client ID').fill('test-client-123');
    await page.getByLabel('Client Secret').fill('ExampleSecret123');
    await page.getByLabel('Environment').selectOption('development');

    // Submit the form
    await page.click('button[type="submit"]');

    // Check for processing indicator
    await expect(page.getByTestId('processing-indicator')).toBeVisible();
  });

  test('should validate form inputs', async ({ page }) => {
    // Wait for WASM to load (button should be disabled initially)
    await page.waitForSelector('button[type="submit"][disabled]', { timeout: 5000 });

    // Fill in valid data first to enable the button
    await page.getByLabel('Client ID').fill('test-client');
    await page.getByLabel('Client Secret').fill('password123');
    await page.getByLabel('Environment').selectOption('development');

    // Wait for button to be enabled
    await page.waitForSelector('button[type="submit"]', { timeout: 10000 });

    // Clear the form to test validation
    await page.getByLabel('Client ID').fill('');
    await page.getByLabel('Client Secret').fill('');

    // Button should be disabled again
    await expect(page.locator('button[type="submit"]')).toBeDisabled();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

    // Click submit without filling fields
    await page.click('button[type="submit"]');

    // Check for validation errors - only clientId and clientSecret are validated client-side
    await expect(page.getByRole('alert')).toHaveCount(2); // clientId, clientSecret
  });

  test('should accept valid credentials and show results', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

    // Fill out the form with valid data using accessible selectors
    await page.getByLabel('Client ID').fill('test-client-123');
    await page.getByLabel('Client Secret').fill('ExampleSecret123');
    await page.getByLabel('Environment').selectOption('development');

    // Submit the form
    await page.click('button[type="submit"]');

    // Check for loading state
    await expect(page.locator('button[type="submit"]')).toContainText('Processing...');

    // Wait for results
    await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

    // Verify results are displayed
    await expect(page.getByTestId('result')).toBeVisible();
    await expect(page.getByTestId('result')).toContainText('Result:');
  });

  test('should handle different environments', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

    // Test development environment
    await page.getByLabel('Client ID').fill('test-client-dev');
    await page.getByLabel('Client Secret').fill('DevPass123');
    await page.getByLabel('Environment').selectOption('development');
    await page.click('button[type="submit"]');

    await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.getByTestId('result')).toContainText('localhost:8080');

    // Clear and test staging environment
    await page.reload();
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

    await page.getByLabel('Client ID').fill('test-client-staging');
    await page.getByLabel('Client Secret').fill('StagingPass123');
    await page.getByLabel('Environment').selectOption('staging');
    await page.click('button[type="submit"]');

    await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.getByTestId('result')).toContainText('staging.example.com');
  });

  test('should handle invalid credentials gracefully', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

    // Submit invalid client ID (client-side validation should catch this)
    await page.getByLabel('Client ID').fill('invalid@client');
    await page.getByLabel('Client Secret').fill('MySecurePass123');
    await page.getByLabel('Environment').selectOption('development');
    await page.click('button[type="submit"]');

    // Check for field error message instead of toast
    await expect(page.getByText('Client ID must contain only alphanumeric characters and hyphens')).toBeVisible();
  });

  test('should clear sensitive data after submission', async ({ page }) => {
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

    // Fill and submit form
    await page.getByLabel('Client ID').fill('test-client-123');
    await page.getByLabel('Client Secret').fill('MySecurePass123');
    await page.getByLabel('Environment').selectOption('development');
    await page.click('button[type="submit"]');

    // Wait for processing to complete
    await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

    // Check that client secret is cleared
    await expect(page.getByLabel('Client Secret')).toHaveValue('');
    // Client ID should still be there
    await expect(page.getByLabel('Client ID')).toHaveValue('test-client-123');
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
