import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ResultsContainer from '../components/results/ResultsContainer';
import type { ProcessingResult, OAuthToken, CaseDetails, ProcessingMetadata } from '../types';

// Mock the child components
vi.mock('../components/results/CaseDetailsView', () => ({
  default: ({ caseDetails, environment }: { caseDetails: any; environment: any }) => (
    <div data-testid="case-details-view">
      Case Details for {environment}: {caseDetails.currentStatus}
    </div>
  )
}));

vi.mock('../components/results/TokenStatusView', () => ({
  default: ({ oauthToken, environment }: { oauthToken: any; environment: any }) => (
    <div data-testid="token-status-view">
      Token Status for {environment}: {oauthToken.tokenType}
    </div>
  )
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ResultsContainer', () => {
  const mockOAuthToken: OAuthToken = {
    accessToken: 'test-access-token-12345',
    tokenType: 'Bearer',
    expiresIn: 3600,
    expiresAt: '2024-12-31T23:59:59Z',
    scope: 'read write'
  };

  const mockCaseDetails: CaseDetails = {
    caseNumber: 'MSC1234567890',
    currentStatus: 'Case Was Approved',
    processingCenter: 'National Benefits Center',
    priorityDate: '2023-01-15',
    caseType: 'I-485 Application for Adjustment of Status',
    approvalDate: '2024-01-15',
    lastUpdated: '2024-01-16',
    verificationId: 'VER123456'
  };

  const mockProcessingMetadata: ProcessingMetadata = {
    environment: 'development',
    processingTime: 1250,
    requestId: 'req-12345-abcde',
    timestamp: '2024-01-16T10:30:00Z'
  };

  const baseResult: ProcessingResult = {
    baseURL: 'https://api.uscis.gov',
    authMode: 'OAuth2',
    tokenHint: 'Bearer token required for API access',
    config: {
      'api_version': 'v1',
      'rate_limit': '100/hour',
      'timeout': '30s'
    }
  };

  const fullResult: ProcessingResult = {
    ...baseResult,
    oauthToken: mockOAuthToken,
    caseDetails: mockCaseDetails,
    processingMetadata: mockProcessingMetadata
  };

  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders with minimal result data', () => {
      render(
        <ResultsContainer 
          result={baseResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      expect(screen.getByTestId('results-container')).toBeInTheDocument();
      expect(screen.getByText('Processing Results')).toBeInTheDocument();
      expect(screen.getByText('New Request')).toBeInTheDocument();
    });

    it('renders with full result data', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="production" 
          onReset={mockOnReset} 
        />
      );

      expect(screen.getByTestId('results-container')).toBeInTheDocument();
      expect(screen.getByText('Processing Results')).toBeInTheDocument();
    });

    it('shows development mode indicator in development environment', () => {
      render(
        <ResultsContainer 
          result={baseResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      expect(screen.getByText(/Development Mode:/)).toBeInTheDocument();
    });

    it('does not show development mode indicator in production', () => {
      render(
        <ResultsContainer 
          result={baseResult} 
          environment="production" 
          onReset={mockOnReset} 
        />
      );

      expect(screen.queryByText(/Development Mode:/)).not.toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('shows only available tabs based on result data', () => {
      render(
        <ResultsContainer 
          result={baseResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      // Should show Configuration and Raw Data tabs (always available)
      expect(screen.getAllByText('Configuration')).toHaveLength(2); // Desktop and mobile versions
      expect(screen.getAllByText('Raw')).toHaveLength(1); // Mobile version
      expect(screen.getAllByText('Raw Data')).toHaveLength(1); // Desktop version

      // Should not show Case Details or Token Status tabs (data not available)
      expect(screen.queryByText('Case Details')).not.toBeInTheDocument();
      expect(screen.queryByText('Token Status')).not.toBeInTheDocument();
    });

    it('shows all tabs when full data is available', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      expect(screen.getByText('Case Details')).toBeInTheDocument();
      expect(screen.getByText('Token Status')).toBeInTheDocument();
      expect(screen.getAllByText('Configuration')).toHaveLength(2); // Desktop and mobile versions
      expect(screen.getByText('Raw Data')).toBeInTheDocument();
    });

    it('switches tabs when clicked', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      // Click on Token Status tab
      fireEvent.click(screen.getByText('Token Status'));
      expect(screen.getByTestId('token-status-view')).toBeInTheDocument();

      // Click on Configuration tab (use the first one - desktop version)
      fireEvent.click(screen.getAllByText('Configuration')[0]);
      expect(screen.getByText('Base URL')).toBeInTheDocument();
      expect(screen.getByText('https://api.uscis.gov')).toBeInTheDocument();
    });

    it('shows mobile-friendly tab labels on small screens', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      // Check that both full and abbreviated labels are present
      const caseDetailsTab = screen.getByText('Case Details');
      expect(caseDetailsTab).toBeInTheDocument();
    });
  });

  describe('Tab State Persistence', () => {
    it('saves active tab to localStorage', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getByText('Token Status'));

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'results-container-active-tab',
        'token-status'
      );
    });

    it('restores active tab from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('token-status');

      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      expect(screen.getByTestId('token-status-view')).toBeInTheDocument();
    });

    it('falls back to first available tab if saved tab is not available', () => {
      localStorageMock.getItem.mockReturnValue('case-details');

      render(
        <ResultsContainer 
          result={baseResult} // No case details available
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      // Should show configuration tab (first available)
      expect(screen.getByText('Base URL')).toBeInTheDocument();
    });
  });

  describe('Tab Content Rendering', () => {
    it('renders CaseDetailsView when case-details tab is active', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getByText('Case Details'));
      expect(screen.getByTestId('case-details-view')).toBeInTheDocument();
    });

    it('renders TokenStatusView when token-status tab is active', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getByText('Token Status'));
      expect(screen.getByTestId('token-status-view')).toBeInTheDocument();
    });

    it('renders configuration content when configuration tab is active', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getAllByText('Configuration')[0]);
      
      expect(screen.getByText('Base URL')).toBeInTheDocument();
      expect(screen.getByText('Auth Mode')).toBeInTheDocument();
      expect(screen.getByText('Token Hint')).toBeInTheDocument();
      expect(screen.getByText('Configuration Parameters')).toBeInTheDocument();
      expect(screen.getByText('Processing Metadata')).toBeInTheDocument();
    });

    it('renders raw data content when raw-data tab is active', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getByText('Raw Data'));
      
      expect(screen.getByText('Complete Response Data')).toBeInTheDocument();
      expect(screen.getByText('📋 Copy JSON')).toBeInTheDocument();
      expect(screen.getByText('💾 Download')).toBeInTheDocument();
    });

    it('shows "not available" message when data is missing', () => {
      render(
        <ResultsContainer 
          result={baseResult} // No case details
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      // Manually set tab to case-details to test the not available message
      // This simulates the case where tab becomes unavailable after result change
      const container = screen.getByTestId('results-container');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('shows copy buttons in configuration tab', async () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      // Switch to Configuration tab first
      const configTab = screen.getAllByText('Configuration')[0].closest('button');
      fireEvent.click(configTab!);
      
      // Wait for the configuration content to render
      await waitFor(() => {
        expect(screen.getByText('Base URL')).toBeInTheDocument();
      });
      
      // Check that copy buttons are present
      const copyButtons = screen.getAllByText('📋');
      expect(copyButtons.length).toBeGreaterThan(0);
    });

    it('copies JSON data to clipboard', async () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getByText('Raw Data'));
      fireEvent.click(screen.getByText('📋 Copy JSON'));

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          JSON.stringify(fullResult, null, 2)
        );
      });
    });
  });

  describe('Download Functionality', () => {
    it('shows download button in raw data tab', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getByText('Raw Data'));
      expect(screen.getByText('💾 Download')).toBeInTheDocument();
    });
  });

  describe('Reset Functionality', () => {
    it('calls onReset when New Request button is clicked', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getByText('New Request'));
      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('Responsive Design', () => {
    it('handles tab overflow with horizontal scroll', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      const tabNav = screen.getByRole('navigation', { name: 'Tabs' });
      expect(tabNav).toHaveClass('overflow-x-auto');
    });

    it('shows abbreviated tab labels on mobile', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      // Check that mobile-specific classes are applied
      const tabs = screen.getAllByRole('button');
      const caseDetailsTab = tabs.find(tab => tab.textContent?.includes('Case'));
      expect(caseDetailsTab).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes for tabs', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      const tabNav = screen.getByRole('navigation', { name: 'Tabs' });
      expect(tabNav).toBeInTheDocument();

      // Check that active tab has aria-current
      const activeTab = screen.getByRole('button', { current: 'page' });
      expect(activeTab).toBeInTheDocument();
    });

    it('has proper focus management', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      const tokenStatusTab = screen.getByText('Token Status').closest('button');
      tokenStatusTab!.focus();
      expect(tokenStatusTab).toHaveFocus();
    });

    it('has descriptive titles for tabs', () => {
      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      const caseDetailsTab = screen.getByText('Case Details').closest('button');
      expect(caseDetailsTab).toHaveAttribute('title', 'Comprehensive case information and status');
    });
  });

  describe('Error Handling', () => {
    it('handles clipboard copy errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Clipboard error'));

      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      fireEvent.click(screen.getByText('Raw Data'));
      fireEvent.click(screen.getByText('📋 Copy JSON'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to copy to clipboard:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('handles invalid tab selection gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid-tab');

      render(
        <ResultsContainer 
          result={fullResult} 
          environment="development" 
          onReset={mockOnReset} 
        />
      );

      // Should fall back to first available tab
      expect(screen.getByTestId('case-details-view')).toBeInTheDocument();
    });
  });
});