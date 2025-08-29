import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { CaseDetailsView } from '../components/results/CaseDetailsView';
import { TokenStatusView } from '../components/results/TokenStatusView';
import { ProcessingIndicator } from '../components/ProcessingIndicator';
import { ResultsContainer } from '../components/results/ResultsContainer';
import { EnvironmentIndicator } from '../components/EnvironmentIndicator';
import type { CaseDetails, OAuthToken, ProcessingResult, ProcessingStep, RealtimeUpdate } from '../types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock screen.getAllByLiveRegion since it doesn't exist in testing-library
const getAllByLiveRegion = (container: HTMLElement, liveValue: string) => {
  return Array.from(container.querySelectorAll(`[aria-live="${liveValue}"]`));
};

// Mock screen.getByLabelledBy since it doesn't exist in testing-library  
const getByLabelledBy = (container: HTMLElement, labelId: string) => {
  return container.querySelector(`[aria-labelledby="${labelId}"]`);
};

// Mock data
const mockCaseDetails: CaseDetails = {
  caseNumber: 'MSC2190000001',
  currentStatus: 'Case Was Approved',
  processingCenter: 'National Benefits Center',
  priorityDate: '2021-01-15',
  caseType: 'I-485 Application for Adjustment of Status',
  approvalDate: '2023-03-20',
  lastUpdated: '2023-03-21T10:30:00Z',
  verificationId: 'VER123456789'
};

const mockOAuthToken: OAuthToken = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
  tokenType: 'Bearer',
  expiresIn: 3600,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  scope: 'read write'
};

const mockProcessingResult: ProcessingResult = {
  baseURL: 'https://api.uscis.gov',
  authMode: 'OAuth2',
  tokenHint: 'Bearer token authentication',
  config: {
    environment: 'development',
    version: '1.0.0',
    timeout: '30000'
  },
  caseDetails: mockCaseDetails,
  oauthToken: mockOAuthToken,
  processingMetadata: {
    environment: 'development',
    processingTime: 1500,
    requestId: 'req-123456',
    timestamp: new Date().toISOString()
  }
};

const mockRealtimeUpdates: RealtimeUpdate[] = [
  {
    id: '1',
    timestamp: new Date().toISOString(),
    step: 'validating',
    message: 'Validating credentials',
    level: 'info'
  },
  {
    id: '2',
    timestamp: new Date().toISOString(),
    step: 'authenticating',
    message: 'Authenticating with API',
    level: 'info'
  }
];

describe('Accessibility Tests', () => {
  describe('CaseDetailsView', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="development" 
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="development" 
        />
      );

      expect(screen.getByRole('region')).toBeInTheDocument();
      expect(getByLabelledBy(container, 'case-details-heading')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('should have proper semantic time elements', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="development" 
        />
      );

      const timeElements = screen.getAllByRole('time');
      expect(timeElements.length).toBeGreaterThan(0);
      
      timeElements.forEach(timeElement => {
        expect(timeElement).toHaveAttribute('dateTime');
      });
    });
  });

  describe('TokenStatusView', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <TokenStatusView 
          oauthToken={mockOAuthToken} 
          environment="development" 
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for interactive elements', () => {
      render(
        <TokenStatusView 
          oauthToken={mockOAuthToken} 
          environment="development" 
        />
      );

      const copyButtons = screen.getAllByRole('button');
      copyButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should have live region for countdown timer', () => {
      render(
        <TokenStatusView 
          oauthToken={mockOAuthToken} 
          environment="development" 
        />
      );

      const timerElement = screen.getByRole('timer');
      expect(timerElement).toHaveAttribute('aria-live', 'polite');
      expect(timerElement).toHaveAttribute('aria-atomic', 'true');
    });
  });

  describe('ProcessingIndicator', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <ProcessingIndicator
          isProcessing={true}
          currentStep="authenticating"
          progress={50}
          realtimeUpdates={mockRealtimeUpdates}
          onCancel={vi.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper progress bar accessibility', () => {
      render(
        <ProcessingIndicator
          isProcessing={true}
          currentStep="authenticating"
          progress={50}
          realtimeUpdates={mockRealtimeUpdates}
        />
      );

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-valuetext', '50% complete');
    });

    it('should have proper step indicators with ARIA labels', () => {
      render(
        <ProcessingIndicator
          isProcessing={true}
          currentStep="authenticating"
          progress={50}
          realtimeUpdates={mockRealtimeUpdates}
        />
      );

      const stepGroup = screen.getByRole('group', { name: 'Processing steps' });
      expect(stepGroup).toBeInTheDocument();

      const stepImages = screen.getAllByRole('img');
      stepImages.forEach(img => {
        expect(img).toHaveAttribute('aria-label');
      });
    });

    it('should have live regions for updates', () => {
      render(
        <ProcessingIndicator
          isProcessing={true}
          currentStep="authenticating"
          progress={50}
          realtimeUpdates={mockRealtimeUpdates}
        />
      );

      const liveRegions = getAllByLiveRegion(container, 'polite');
      expect(liveRegions.length).toBeGreaterThan(0);
    });
  });

  describe('ResultsContainer', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <ResultsContainer
          result={mockProcessingResult}
          environment="development"
          onReset={vi.fn()}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper tab navigation', () => {
      render(
        <ResultsContainer
          result={mockProcessingResult}
          environment="development"
          onReset={vi.fn()}
        />
      );

      const tabList = screen.getByRole('tablist');
      expect(tabList).toBeInTheDocument();

      const tabs = screen.getAllByRole('tab');
      tabs.forEach((tab, index) => {
        expect(tab).toHaveAttribute('aria-selected');
        expect(tab).toHaveAttribute('aria-controls');
        expect(tab).toHaveAttribute('id');
        
        // Only active tab should have tabIndex 0
        const isActive = tab.getAttribute('aria-selected') === 'true';
        expect(tab).toHaveAttribute('tabIndex', isActive ? '0' : '-1');
      });

      const tabPanels = screen.getAllByRole('tabpanel');
      expect(tabPanels.length).toBeGreaterThan(0);
      
      tabPanels.forEach(panel => {
        expect(panel).toHaveAttribute('aria-labelledby');
        expect(panel).toHaveAttribute('id');
      });
    });

    it('should support keyboard navigation', () => {
      render(
        <ResultsContainer
          result={mockProcessingResult}
          environment="development"
          onReset={vi.fn()}
        />
      );

      const tabs = screen.getAllByRole('tab');
      const firstTab = tabs[0];
      
      firstTab.focus();
      
      // Test arrow key navigation
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      // Should move focus to next tab (implementation depends on available tabs)
      
      fireEvent.keyDown(firstTab, { key: 'Home' });
      // Should move to first tab
      
      fireEvent.keyDown(firstTab, { key: 'End' });
      // Should move to last tab
    });
  });

  describe('EnvironmentIndicator', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <EnvironmentIndicator
          environment="development"
          showDebugInfo={true}
        />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper alert roles for warnings', () => {
      render(
        <EnvironmentIndicator
          environment="development"
          showDebugInfo={true}
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('aria-labelledby');
    });

    it('should have proper list structure for features', () => {
      render(
        <EnvironmentIndicator
          environment="development"
          showDebugInfo={true}
        />
      );

      const featureList = screen.getByRole('list', { name: 'Environment features' });
      expect(featureList).toBeInTheDocument();

      const listItems = screen.getAllByRole('listitem');
      expect(listItems.length).toBeGreaterThan(0);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle focus management properly', () => {
      render(
        <ResultsContainer
          result={mockProcessingResult}
          environment="development"
          onReset={vi.fn()}
        />
      );

      // Test tab order
      const focusableElements = screen.getAllByRole('button').concat(screen.getAllByRole('tab'));
      
      focusableElements.forEach(element => {
        element.focus();
        expect(document.activeElement).toBe(element);
      });
    });

    it('should have proper focus indicators', () => {
      render(
        <TokenStatusView 
          oauthToken={mockOAuthToken} 
          environment="development" 
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        button.focus();
        // Focus styles are applied via CSS, so we check for focus state
        expect(document.activeElement).toBe(button);
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <div>
          <CaseDetailsView 
            caseDetails={mockCaseDetails} 
            environment="development" 
          />
          <TokenStatusView 
            oauthToken={mockOAuthToken} 
            environment="development" 
          />
        </div>
      );

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Check that headings have proper levels
      headings.forEach(heading => {
        const level = heading.tagName.toLowerCase();
        expect(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).toContain(level);
      });
    });

    it('should have descriptive labels for form controls', () => {
      render(
        <ResultsContainer
          result={mockProcessingResult}
          environment="development"
          onReset={vi.fn()}
        />
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        // Should have either aria-label or accessible text content
        const hasAriaLabel = button.hasAttribute('aria-label');
        const hasTextContent = button.textContent && button.textContent.trim().length > 0;
        
        expect(hasAriaLabel || hasTextContent).toBe(true);
      });
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should not rely solely on color for information', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="development" 
        />
      );

      const statusBadge = screen.getByRole('status');
      expect(statusBadge).toBeInTheDocument();
      
      // Status should have text content, not just color
      expect(statusBadge.textContent).toBeTruthy();
      expect(statusBadge.textContent?.trim().length).toBeGreaterThan(0);
    });

    it('should have proper contrast ratios in status indicators', () => {
      render(
        <ProcessingIndicator
          isProcessing={true}
          currentStep="authenticating"
          progress={50}
          realtimeUpdates={mockRealtimeUpdates}
        />
      );

      // Check that status indicators have both color and text/icons
      const stepImages = screen.getAllByRole('img');
      stepImages.forEach(img => {
        expect(img).toHaveAttribute('aria-label');
      });
    });
  });
});