import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
  });

  test.describe('Initial State Screenshots', () => {
    test('should match initial application layout', async ({ page }) => {
      // Wait for all elements to load
      await page.waitForLoadState('networkidle');
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('initial-layout.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('should match form component layout', async ({ page }) => {
      const form = page.locator('form');
      await expect(form).toHaveScreenshot('credential-form.png', {
        animations: 'disabled'
      });
    });

    test('should match environment selector states', async ({ page }) => {
      // Test each environment option
      const environments = ['development', 'staging', 'production'];
      
      for (const env of environments) {
        await page.getByLabel('Environment').selectOption(env);
        await page.waitForTimeout(100); // Allow for any visual changes
        
        await expect(page.locator('form')).toHaveScreenshot(`form-${env}.png`, {
          animations: 'disabled'
        });
      }
    });
  });

  test.describe('Processing State Screenshots', () => {
    test('should match processing indicator layout', async ({ page }) => {
      // Fill and submit form to trigger processing
      await page.getByLabel('Client ID').fill('visual-test-client');
      await page.getByLabel('Client Secret').fill('VisualSecret123');
      await page.getByLabel('Environment').selectOption('development');
      
      await page.click('button[type="submit"]');
      
      // Wait for processing indicator to appear
      await page.getByTestId('processing-indicator').waitFor({ state: 'visible' });
      
      // Take screenshot of processing state
      await expect(page).toHaveScreenshot('processing-state.png', {
        fullPage: true,
        animations: 'disabled'
      });
      
      // Screenshot just the processing indicator
      await expect(page.getByTestId('processing-indicator')).toHaveScreenshot('processing-indicator.png', {
        animations: 'disabled'
      });
    });

    test('should match form disabled state during processing', async ({ page }) => {
      await page.getByLabel('Client ID').fill('disabled-test-client');
      await page.getByLabel('Client Secret').fill('DisabledSecret123');
      await page.getByLabel('Environment').selectOption('development');
      
      await page.click('button[type="submit"]');
      
      // Wait for form to be disabled
      await expect(page.getByRole('button', { name: /processing/i })).toBeVisible();
      
      await expect(page.locator('form')).toHaveScreenshot('form-disabled.png', {
        animations: 'disabled'
      });
    });
  });

  test.describe('Results State Screenshots', () => {
    async function submitAndWaitForResults(page: any) {
      await page.getByLabel('Client ID').fill('results-visual-test');
      await page.getByLabel('Client Secret').fill('ResultsSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
    }

    test('should match complete results layout', async ({ page }) => {
      await submitAndWaitForResults(page);
      
      // Take full page screenshot with results
      await expect(page).toHaveScreenshot('results-complete.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('should match results container with tabs', async ({ page }) => {
      await submitAndWaitForResults(page);
      
      const resultsContainer = page.getByTestId('result');
      await expect(resultsContainer).toHaveScreenshot('results-container.png', {
        animations: 'disabled'
      });
    });

    test('should match each tab content', async ({ page }) => {
      await submitAndWaitForResults(page);
      
      // Get all tabs
      const tabs = page.getAllByRole('tab');
      const tabCount = await tabs.count();
      
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        const tabName = await tab.textContent();
        const sanitizedName = tabName?.toLowerCase().replace(/\s+/g, '-') || `tab-${i}`;
        
        await tab.click();
        await page.waitForTimeout(200); // Allow tab content to load
        
        const tabPanel = page.getByRole('tabpanel', { includeHidden: false });
        await expect(tabPanel).toHaveScreenshot(`tab-${sanitizedName}.png`, {
          animations: 'disabled'
        });
      }
    });

    test('should match case details view', async ({ page }) => {
      await submitAndWaitForResults(page);
      
      // Navigate to case details tab
      const caseDetailsTab = page.getByRole('tab', { name: /case details/i });
      await caseDetailsTab.click();
      
      const caseDetailsView = page.locator('[data-testid*="case-details"], .case-details');
      if (await caseDetailsView.count() > 0) {
        await expect(caseDetailsView.first()).toHaveScreenshot('case-details-view.png', {
          animations: 'disabled'
        });
      }
    });

    test('should match token status view', async ({ page }) => {
      await submitAndWaitForResults(page);
      
      // Navigate to token status tab
      const tokenStatusTab = page.getByRole('tab', { name: /token status/i });
      await tokenStatusTab.click();
      
      const tokenStatusView = page.locator('[data-testid*="token-status"], .token-status');
      if (await tokenStatusView.count() > 0) {
        await expect(tokenStatusView.first()).toHaveScreenshot('token-status-view.png', {
          animations: 'disabled'
        });
      }
    });

    test('should match configuration view', async ({ page }) => {
      await submitAndWaitForResults(page);
      
      // Navigate to configuration tab
      const configTab = page.getByRole('tab', { name: /configuration/i });
      await configTab.click();
      
      const configView = page.getByRole('tabpanel', { includeHidden: false });
      await expect(configView).toHaveScreenshot('configuration-view.png', {
        animations: 'disabled'
      });
    });

    test('should match raw data view with JSON', async ({ page }) => {
      await submitAndWaitForResults(page);
      
      // Navigate to raw data tab
      const rawDataTab = page.getByRole('tab', { name: /raw data/i });
      await rawDataTab.click();
      
      // Wait for JSON to render
      await page.locator('pre').waitFor({ state: 'visible' });
      
      const rawDataView = page.getByRole('tabpanel', { includeHidden: false });
      await expect(rawDataView).toHaveScreenshot('raw-data-view.png', {
        animations: 'disabled'
      });
    });
  });

  test.describe('Environment-Specific Screenshots', () => {
    test('should match development environment styling', async ({ page }) => {
      await page.getByLabel('Environment').selectOption('development');
      await page.getByLabel('Client ID').fill('dev-visual-test');
      await page.getByLabel('Client Secret').fill('DevVisualSecret123');
      await page.click('button[type="submit"]');
      
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
      
      // Check for environment indicator
      const envIndicator = page.getByTestId('environment-indicator');
      if (await envIndicator.isVisible()) {
        await expect(envIndicator).toHaveScreenshot('env-indicator-development.png', {
          animations: 'disabled'
        });
      }
      
      await expect(page).toHaveScreenshot('development-environment.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('should match staging environment styling', async ({ page }) => {
      await page.getByLabel('Environment').selectOption('staging');
      await page.getByLabel('Client ID').fill('staging-visual-test');
      await page.getByLabel('Client Secret').fill('StagingVisualSecret123');
      await page.click('button[type="submit"]');
      
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
      
      const envIndicator = page.getByTestId('environment-indicator');
      if (await envIndicator.isVisible()) {
        await expect(envIndicator).toHaveScreenshot('env-indicator-staging.png', {
          animations: 'disabled'
        });
      }
      
      await expect(page).toHaveScreenshot('staging-environment.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('should match production environment styling', async ({ page }) => {
      await page.getByLabel('Environment').selectOption('production');
      await page.getByLabel('Client ID').fill('prod-visual-test');
      await page.getByLabel('Client Secret').fill('ProdVisualSecret123');
      await page.click('button[type="submit"]');
      
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
      
      const envIndicator = page.getByTestId('environment-indicator');
      if (await envIndicator.isVisible()) {
        await expect(envIndicator).toHaveScreenshot('env-indicator-production.png', {
          animations: 'disabled'
        });
      }
      
      await expect(page).toHaveScreenshot('production-environment.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Error State Screenshots', () => {
    test('should match validation error states', async ({ page }) => {
      // Submit empty form to trigger validation errors
      await page.click('button[type="submit"]');
      
      // Wait for validation errors to appear
      await page.getByRole('alert').first().waitFor({ state: 'visible' });
      
      await expect(page.locator('form')).toHaveScreenshot('validation-errors.png', {
        animations: 'disabled'
      });
    });

    test('should match field-specific error states', async ({ page }) => {
      // Test invalid client ID format
      await page.getByLabel('Client ID').fill('invalid@client!');
      await page.getByLabel('Client Secret').fill('ValidSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');
      
      // Wait for field error to appear
      await page.getByText(/must contain only alphanumeric characters/i).waitFor({ state: 'visible' });
      
      await expect(page.locator('form')).toHaveScreenshot('field-error.png', {
        animations: 'disabled'
      });
    });
  });

  test.describe('Responsive Design Screenshots', () => {
    test('should match desktop layout', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.reload();
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
      
      await expect(page).toHaveScreenshot('desktop-layout.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('should match tablet layout', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
      
      await expect(page).toHaveScreenshot('tablet-layout.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('should match mobile layout', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
      
      await expect(page).toHaveScreenshot('mobile-layout.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('should match mobile results layout', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
      
      // Submit form and get results
      await page.getByLabel('Client ID').fill('mobile-results-test');
      await page.getByLabel('Client Secret').fill('MobileResultsSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');
      
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
      
      await expect(page).toHaveScreenshot('mobile-results.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('Component State Screenshots', () => {
    test('should match button states', async ({ page }) => {
      // Initial enabled state
      const submitButton = page.getByRole('button', { name: /submit/i });
      await expect(submitButton).toHaveScreenshot('button-enabled.png', {
        animations: 'disabled'
      });
      
      // Disabled state (empty form)
      await page.getByLabel('Client ID').fill('');
      await page.getByLabel('Client Secret').fill('');
      await page.waitForTimeout(100);
      
      await expect(submitButton).toHaveScreenshot('button-disabled.png', {
        animations: 'disabled'
      });
      
      // Processing state
      await page.getByLabel('Client ID').fill('button-test-client');
      await page.getByLabel('Client Secret').fill('ButtonSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');
      
      await expect(page.getByRole('button', { name: /processing/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /processing/i })).toHaveScreenshot('button-processing.png', {
        animations: 'disabled'
      });
    });

    test('should match form field states', async ({ page }) => {
      const clientIdField = page.getByLabel('Client ID');
      const clientSecretField = page.getByLabel('Client Secret');
      
      // Empty state
      await expect(clientIdField).toHaveScreenshot('field-empty.png', {
        animations: 'disabled'
      });
      
      // Filled state
      await clientIdField.fill('test-client-123');
      await expect(clientIdField).toHaveScreenshot('field-filled.png', {
        animations: 'disabled'
      });
      
      // Focused state
      await clientSecretField.focus();
      await expect(clientSecretField).toHaveScreenshot('field-focused.png', {
        animations: 'disabled'
      });
      
      // Error state
      await clientIdField.fill('invalid@client!');
      await page.click('button[type="submit"]');
      await page.getByText(/must contain only alphanumeric characters/i).waitFor({ state: 'visible' });
      
      await expect(clientIdField).toHaveScreenshot('field-error.png', {
        animations: 'disabled'
      });
    });

    test('should match progress indicator states', async ({ page }) => {
      await page.getByLabel('Client ID').fill('progress-test-client');
      await page.getByLabel('Client Secret').fill('ProgressSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');
      
      const progressIndicator = page.getByTestId('processing-indicator');
      await progressIndicator.waitFor({ state: 'visible' });
      
      // Take screenshot of progress indicator
      await expect(progressIndicator).toHaveScreenshot('progress-indicator.png', {
        animations: 'disabled'
      });
      
      // Check for progress bar specifically
      const progressBar = page.getByRole('progressbar');
      if (await progressBar.isVisible()) {
        await expect(progressBar).toHaveScreenshot('progress-bar.png', {
          animations: 'disabled'
        });
      }
    });
  });

  test.describe('Dark Mode Screenshots', () => {
    test('should match dark mode layout', async ({ page }) => {
      // Enable dark mode (if supported)
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
      
      await expect(page).toHaveScreenshot('dark-mode-layout.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('should match dark mode results', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
      
      // Submit form and get results
      await page.getByLabel('Client ID').fill('dark-mode-test');
      await page.getByLabel('Client Secret').fill('DarkModeSecret123');
      await page.getByLabel('Environment').selectOption('development');
      await page.click('button[type="submit"]');
      
      await page.getByTestId('result').waitFor({ state: 'visible', timeout: 20000 });
      
      await expect(page).toHaveScreenshot('dark-mode-results.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });

  test.describe('High Contrast Screenshots', () => {
    test('should match high contrast mode', async ({ page }) => {
      // Enable high contrast mode
      await page.emulateMedia({ 
        colorScheme: 'dark',
        forcedColors: 'active'
      });
      await page.reload();
      await page.waitForSelector('button[type="submit"]', { timeout: 15000 });
      
      await expect(page).toHaveScreenshot('high-contrast-layout.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });
  });
});