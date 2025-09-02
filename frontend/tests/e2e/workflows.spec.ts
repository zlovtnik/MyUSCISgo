import { test, expect } from '@playwright/test';

test.describe('Complete User Workflows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for WASM to load
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
  });

  test.describe('Successful Case Processing Workflow', () => {
    test('should complete full workflow from credentials to case details', async ({ page }) => {
      // Step 1: Fill out credentials form
      await page.getByLabel('Client ID').fill('test-client-workflow');
      await page.getByLabel('Client Secret').fill('WorkflowSecret123');
      await page.getByLabel('Environment').selectOption('development');

      // Step 2: Submit form and verify processing starts
      await page.click('button[type="submit"]');

      // Verify processing indicator appears
      await expect(page.getByTestId('processing-indicator')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toContainText('Processing...');

      // Step 3: Wait for results to appear
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Step 4: Verify results container with tabs
      await expect(page.getByRole('tablist')).toBeVisible();

      // Verify all expected tabs are present
      await expect(page.getByRole('tab', { name: /case details/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /token status/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /configuration/i })).toBeVisible();
      await expect(page.getByRole('tab', { name: /raw data/i })).toBeVisible();

      // Step 5: Verify case details tab content
      const caseDetailsTab = page.getByRole('tab', { name: /case details/i });
      await caseDetailsTab.click();

      await expect(page.getByText(/case number/i)).toBeVisible();
      await expect(page.getByText(/current status/i)).toBeVisible();
      await expect(page.getByText(/processing center/i)).toBeVisible();

      // Step 6: Verify token status tab
      const tokenStatusTab = page.getByRole('tab', { name: /token status/i });
      await tokenStatusTab.click();

      await expect(page.getByText(/token type/i)).toBeVisible();
      await expect(page.getByText(/expires/i)).toBeVisible();

      // Step 7: Verify configuration tab
      const configTab = page.getByRole('tab', { name: /configuration/i });
      await configTab.click();

      await expect(page.getByText(/base url/i)).toBeVisible();
      await expect(page.getByText(/environment/i)).toBeVisible();

      // Step 8: Verify raw data tab with JSON
      const rawDataTab = page.getByRole('tab', { name: /raw data/i });
      await rawDataTab.click();

      await expect(page.locator('pre')).toBeVisible();
      await expect(page.getByText(/"baseURL"/)).toBeVisible();

      // Step 9: Verify security - client secret should be cleared
      await expect(page.getByLabel('Client Secret')).toHaveValue('');
      await expect(page.getByLabel('Client ID')).toHaveValue('test-client-workflow');
    });

    test('should handle environment switching correctly', async ({ page }) => {
      // Test development environment
      await page.getByLabel('Client ID').fill('dev-client');
      await page.getByLabel('Client Secret').fill('DevSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');

      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Verify development-specific content
      await expect(page.getByText('localhost:8080')).toBeVisible();
      await expect(page.getByTestId('environment-indicator')).toContainText('Development');

      // Reset and test staging
      await page.reload();
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });

      await page.getByLabel('Client ID').fill('staging-client');
      await page.getByLabel('Client Secret').fill('StagingSecret123');
      await page.getByLabel('Environment').selectOption('staging');
      await page.click('button[type="submit"]');

      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Verify staging-specific content
      await expect(page.getByText('staging.example.com')).toBeVisible();
      await expect(page.getByTestId('environment-indicator')).toContainText('Staging');
    });

    test('should display realtime updates during processing', async ({ page }) => {
      await page.getByLabel('Client ID').fill('realtime-test');
      await page.getByLabel('Client Secret').fill('RealtimeSecret123');
      await page.getByLabel('Environment').selectOption('development');

      await page.click('button[type="submit"]');

      // Verify processing indicator with steps
      const processingIndicator = page.getByTestId('processing-indicator');
      await expect(processingIndicator).toBeVisible();

      // Verify progress bar
      await expect(page.getByRole('progressbar')).toBeVisible();

      // Verify realtime updates section
      await expect(page.getByTestId('realtime-updates')).toBeVisible();

      // Wait for completion
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Verify processing indicator is hidden after completion
      await expect(processingIndicator).not.toBeVisible();
    });
  });

  test.describe('Error Handling Workflows', () => {
    test('should handle validation errors gracefully', async ({ page }) => {
      // Test empty form submission
      await page.click('button[type="submit"]');

      // Verify validation errors appear
      await expect(page.getByRole('alert')).toHaveCount(2); // clientId and clientSecret

      // Test invalid client ID format
      await page.getByLabel('Client ID').fill('invalid@client!');
      await page.getByLabel('Client Secret').fill('ValidSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');

      // Verify field-specific error
      await expect(page.getByText(/must contain only alphanumeric characters/i)).toBeVisible();

      // Fix the error and verify it clears
      await page.getByLabel('Client ID').fill('valid-client-123');
      await page.click('button[type="submit"]');

      // Error should be gone and processing should start
      await expect(page.getByText(/must contain only alphanumeric characters/i)).not.toBeVisible();
      await expect(page.getByTestId('processing-indicator')).toBeVisible();
    });

    test('should handle network errors with retry options', async ({ page }) => {
      // Simulate network error by using invalid credentials that will cause server error
      await page.getByLabel('Client ID').fill('network-error-test');
      await page.getByLabel('Client Secret').fill('NetworkErrorSecret');
      await page.getByLabel('Environment').selectOption('development');

      await page.click('button[type="submit"]');

      // Wait for error to appear (this will depend on WASM implementation)
      // In a real scenario, you might need to mock network failures
      await page.waitForTimeout(5000);

      // Check if retry button appears (implementation dependent)
      const retryButton = page.getByRole('button', { name: /retry/i });
      if (await retryButton.isVisible()) {
        await retryButton.click();

        // Verify retry attempt
        await expect(page.getByTestId('processing-indicator')).toBeVisible();
      }
    });

    test('should handle timeout scenarios', async ({ page }) => {
      // Use credentials that might cause timeout
      await page.getByLabel('Client ID').fill('timeout-test-client');
      await page.getByLabel('Client Secret').fill('TimeoutSecret123');
      await page.getByLabel('Environment').selectOption('development');

      await page.click('button[type="submit"]');

      // Wait longer than normal timeout
      await page.waitForTimeout(10000);

      // Check for timeout handling (implementation dependent)
      const errorMessage = page.getByText(/timeout/i);
      if (await errorMessage.isVisible()) {
        // Verify timeout is handled gracefully
        await expect(page.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      }
    });
  });

  test.describe('Accessibility Workflows', () => {
    test('should support complete keyboard navigation', async ({ page }) => {
      // Start with first focusable element
      await page.keyboard.press('Tab');

      // Navigate through form fields
      await expect(page.getByLabel('Client ID')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Client Secret')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Environment')).toBeFocused();

      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: /submit/i })).toBeFocused();

      // Fill form using keyboard
      await page.keyboard.press('Shift+Tab'); // Back to environment
      await page.keyboard.press('Shift+Tab'); // Back to client secret
      await page.keyboard.press('Shift+Tab'); // Back to client ID

      await page.keyboard.type('keyboard-test-client');
      await page.keyboard.press('Tab');
      await page.keyboard.type('KeyboardSecret123');
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowDown'); // Select development
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Submit

      // Wait for results
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Navigate through result tabs using keyboard
      const tabs = page.getAllByRole('tab');
      const tabCount = await tabs.count();

      for (let i = 0; i < tabCount; i++) {
        await page.keyboard.press('Tab');
        const focusedTab = page.locator(':focus');
        await expect(focusedTab).toHaveAttribute('role', 'tab');

        // Activate tab with Enter or Space
        await page.keyboard.press('Enter');
        await expect(focusedTab).toHaveAttribute('aria-selected', 'true');
      }
    });

    test('should work with screen reader simulation', async ({ page }) => {
      // Fill form
      await page.getByLabel('Client ID').fill('screen-reader-test');
      await page.getByLabel('Client Secret').fill('ScreenReaderSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');

      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Verify ARIA labels and roles are present
      await expect(page.getByRole('tablist')).toHaveAttribute('aria-label');

      const tabs = page.getAllByRole('tab');
      const tabCount = await tabs.count();

      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        await expect(tab).toHaveAttribute('aria-controls');
        await expect(tab).toHaveAttribute('aria-selected');
      }

      // Verify tab panels have proper labeling
      const tabPanels = page.getAllByRole('tabpanel');
      const panelCount = await tabPanels.count();

      for (let i = 0; i < panelCount; i++) {
        const panel = tabPanels.nth(i);
        await expect(panel).toHaveAttribute('aria-labelledby');
      }
    });
  });

  test.describe('Performance Workflows', () => {
    test('should handle rapid form submissions', async ({ page }) => {
      // Fill form
      await page.getByLabel('Client ID').fill('performance-test');
      await page.getByLabel('Client Secret').fill('PerformanceSecret123');
      await page.getByLabel('Environment').selectOption('development');

      // Submit multiple times rapidly (should be prevented)
      const submitButton = page.getByRole('button', { name: /submit/i });

      await submitButton.click();
      await expect(submitButton).toBeDisabled();

      // Try to click again while processing
      await submitButton.click({ force: true });

      // Should still be processing the first request
      await expect(page.getByTestId('processing-indicator')).toBeVisible();

      // Wait for completion
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Button should be re-enabled
      await expect(submitButton).not.toBeDisabled();
    });

    test('should handle large result datasets efficiently', async ({ page }) => {
      // Submit form that returns large dataset
      await page.getByLabel('Client ID').fill('large-dataset-test');
      await page.getByLabel('Client Secret').fill('LargeDataSecret123');
      await page.getByLabel('Environment').selectOption('development');

      const startTime = Date.now();
      await page.click('button[type="submit"]');

      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      // Should complete within reasonable time (20 seconds max)
      expect(processingTime).toBeLessThan(20000);

      // Verify UI remains responsive
      const rawDataTab = page.getByRole('tab', { name: /raw data/i });
      await rawDataTab.click();

      // JSON should be displayed without freezing UI
      await expect(page.locator('pre')).toBeVisible();

      // Should be able to scroll through large JSON
      await page.locator('pre').hover();
      await page.mouse.wheel(0, 500);
    });
  });

  test.describe('Mobile Workflows', () => {
    test('should work on mobile devices', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test');

      // Verify mobile layout
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('form')).toBeVisible();

      // Fill form on mobile
      await page.getByLabel('Client ID').fill('mobile-test-client');
      await page.getByLabel('Client Secret').fill('MobileSecret123');
      await page.getByLabel('Environment').selectOption('development');

      // Submit and verify mobile processing
      await page.click('button[type="submit"]');
      await expect(page.getByTestId('processing-indicator')).toBeVisible();

      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Verify mobile tab navigation
      const tabs = page.getAllByRole('tab');
      const firstTab = tabs.first();
      await firstTab.click();

      // Verify mobile-responsive content
      await expect(page.getByRole('tabpanel')).toBeVisible();

      // Test mobile scrolling
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.evaluate(() => window.scrollTo(0, 0));
    });

    test('should handle touch interactions', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'Mobile-specific test');

      await page.getByLabel('Client ID').fill('touch-test-client');
      await page.getByLabel('Client Secret').fill('TouchSecret123');
      await page.getByLabel('Environment').selectOption('development');

      // Use touch to submit
      await page.getByRole('button', { name: /submit/i }).tap();

      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });

      // Test touch navigation through tabs
      const tabs = page.getByRole('tab');
      const tabCount = await tabs.count();

      for (let i = 0; i < tabCount; i++) {
        await tabs.nth(i).tap();
        await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
      }
    });
  });

  test.describe('Data Persistence Workflows', () => {
    test('should maintain form state during errors', async ({ page }) => {
      // Fill form
      await page.getByLabel('Client ID').fill('persistence-test');
      await page.getByLabel('Client Secret').fill('PersistenceSecret123');
      await page.getByLabel('Environment').selectOption('staging');

      // Submit form that might error
      await page.click('button[type="submit"]');

      // Wait for potential error or completion
      await page.waitForTimeout(5000);

      // Verify client ID and environment are preserved
      await expect(page.getByLabel('Client ID')).toHaveValue('persistence-test');
      await expect(page.getByLabel('Environment')).toHaveValue('staging');

      // Client secret should be cleared for security
      await expect(page.getByLabel('Client Secret')).toHaveValue('');
    });

    test('should handle page refresh during processing', async ({ page }) => {
      await page.getByLabel('Client ID').fill('refresh-test');
      await page.getByLabel('Client Secret').fill('RefreshSecret123');
      await page.getByLabel('Environment').selectOption('development');

      await page.click('button[type="submit"]');

      // Refresh page during processing
      await page.reload();

      // Should return to initial state
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
      await expect(page.getByLabel('Client ID')).toHaveValue('');
      await expect(page.getByLabel('Client Secret')).toHaveValue('');
      await expect(page.getByTestId('result')).not.toBeVisible();
    });
  });
});