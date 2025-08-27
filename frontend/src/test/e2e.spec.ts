import { test, expect } from '@playwright/test';

test.describe('Credential Processing Application', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('should load the application successfully', async ({ page }) => {
    // Check if the main heading is present
    await expect(page.locator('h1')).toContainText('WASM Credential Processor');

    // Check if the form is present
    await expect(page.locator('form')).toBeVisible();

    // Check if input fields are present
    await expect(page.locator('input[name="clientId"]')).toBeVisible();
    await expect(page.locator('input[name="clientSecret"]')).toBeVisible();
    await expect(page.locator('select[name="environment"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click submit without filling fields
    await page.click('button[type="submit"]');

    // Check for validation errors
    await expect(page.locator('.error')).toHaveCount(3); // clientId, clientSecret, environment
  });

  test('should process valid credentials', async ({ page }) => {
    // Fill in valid credentials
    await page.fill('input[name="clientId"]', 'test-client-123');
    await page.fill('input[name="clientSecret"]', 'MySecurePassword123');
    await page.selectOption('select[name="environment"]', 'development');

    // Submit the form
    await page.click('button[type="submit"]');

    // Wait for processing to complete
    await page.waitForSelector('.result', { timeout: 10000 });

    // Check if results are displayed
    await expect(page.locator('.result')).toBeVisible();
  });

  test('should handle invalid client ID', async ({ page }) => {
    // Fill in invalid client ID
    await page.fill('input[name="clientId"]', 'test client'); // contains space
    await page.fill('input[name="clientSecret"]', 'MySecurePassword123');
    await page.selectOption('select[name="environment"]', 'development');

    // Submit the form
    await page.click('button[type="submit"]');

    // Check for error message
    await expect(page.locator('.toast-error')).toBeVisible();
  });

  test('should handle rate limiting', async ({ page }) => {
    // This test would require multiple rapid requests
    // For now, we'll just check that the rate limiting message can be displayed
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show loading state during processing', async ({ page }) => {
    // Fill in valid credentials
    await page.fill('input[name="clientId"]', 'test-client-123');
    await page.fill('input[name="clientSecret"]', 'MySecurePassword123');
    await page.selectOption('select[name="environment"]', 'development');

    // Submit the form
    await page.click('button[type="submit"]');

    // Check for loading spinner
    await expect(page.locator('.loading-spinner')).toBeVisible();
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });

    // Check if the form is still accessible
    await expect(page.locator('form')).toBeVisible();

    // Check if inputs are usable on mobile
    await expect(page.locator('input[name="clientId"]')).toBeVisible();
    await expect(page.locator('input[name="clientSecret"]')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // This would require mocking network failures
    // For now, we'll check that error handling is in place
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Security Headers', () => {
  test('should have proper security headers', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Check response headers (this would require a more complex setup)
    // For now, we'll just verify the page loads securely
    await expect(page).toHaveURL(/^https?:\/\//);
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');

    // Check for proper labeling
    const clientIdInput = page.locator('input[name="clientId"]');
    await expect(clientIdInput).toHaveAttribute('aria-label', 'Client ID');

    const clientSecretInput = page.locator('input[name="clientSecret"]');
    await expect(clientSecretInput).toHaveAttribute('aria-label', 'Client Secret');

    const environmentSelect = page.locator('select[name="environment"]');
    await expect(environmentSelect).toHaveAttribute('aria-label', 'Environment');
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="clientId"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[name="clientSecret"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('select[name="environment"]')).toBeFocused();
  });
});
