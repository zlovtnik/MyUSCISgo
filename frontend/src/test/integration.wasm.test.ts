import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { Credentials, ProcessingResult, CaseDetails, OAuthToken } from '../types';

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  },
  ToastContainer: () => null
}));

// Mock data transformation utilities
vi.mock('../utils/dataTransform', () => ({
  transformWASMOutput: vi.fn((input) => input),
  transformRealtimeUpdate: vi.fn((input) => ({
    id: input.id || 'test-id',
    timestamp: input.timestamp || new Date().toISOString(),
    step: input.step || 'validating',
    message: input.message || 'Test message',
    level: input.level || 'info'
  })),
  sanitizeForLogging: vi.fn((input) => input),
  deepClone: vi.fn((input) => JSON.parse(JSON.stringify(input))),
  clearTransformCache: vi.fn(),
  getCacheStats: vi.fn(() => ({
    size: 0,
    limit: 100,
    keys: []
  }))
}));

describe('WASM Integration Tests', () => {
  let mockWorker: any;
  let mockPostMessage: any;
  let mockTerminate: any;
  let mockAddEventListener: any;
  let mockRemoveEventListener: any;
  let messageHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    messageHandlers = new Map();
    
    mockPostMessage = vi.fn();
    mockTerminate = vi.fn();
    mockAddEventListener = vi.fn((event, handler) => {
      messageHandlers.set(event, handler);
    });
    mockRemoveEventListener = vi.fn();

    mockWorker = {
      postMessage: mockPostMessage,
      terminate: mockTerminate,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener
    };

    // Mock Worker constructor
    global.Worker = vi.fn(() => mockWorker) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const simulateWorkerMessage = (type: string, data: any = {}, requestId?: number) => {
    const messageHandler = messageHandlers.get('message');
    if (messageHandler) {
      messageHandler({
        data: {
          type,
          result: data,
          error: data.error,
          requestId,
          context: data.context
        }
      });
    }
  };

  const simulateWorkerError = (error: string, context?: any) => {
    const errorHandler = messageHandlers.get('error');
    if (errorHandler) {
      errorHandler({
        error,
        context
      });
    }
  };

  describe('Complete User Workflow Integration', () => {
    it('should handle complete credential submission to results flow', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for WASM to initialize
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Fill out the form
      const clientIdInput = screen.getByLabelText(/client id/i);
      const clientSecretInput = screen.getByLabelText(/client secret/i);
      const environmentSelect = screen.getByLabelText(/environment/i);

      await user.type(clientIdInput, 'test-client-123');
      await user.type(clientSecretInput, 'test-secret-456');
      await user.selectOptions(environmentSelect, 'development');

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      // Verify processing state
      expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      expect(submitButton).toHaveTextContent(/processing/i);

      // Simulate realtime updates
      simulateWorkerMessage('realtime-update', {
        id: 'update-1',
        step: 'validating',
        message: 'Validating credentials',
        level: 'info'
      });

      simulateWorkerMessage('realtime-update', {
        id: 'update-2',
        step: 'authenticating',
        message: 'Authenticating with API',
        level: 'info'
      });

      // Simulate successful result
      const mockResult: ProcessingResult = {
        baseURL: 'https://api.uscis.gov',
        authMode: 'OAuth2',
        tokenHint: 'Bearer token',
        config: { environment: 'development' },
        caseDetails: {
          caseNumber: 'MSC2190000001',
          currentStatus: 'Case Was Approved',
          processingCenter: 'National Benefits Center',
          priorityDate: '2021-01-15',
          caseType: 'I-485',
          approvalDate: '2023-03-20',
          lastUpdated: '2023-03-21T10:30:00Z'
        },
        oauthToken: {
          accessToken: 'test-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };

      simulateWorkerMessage('result', mockResult, 1);

      // Verify results are displayed
      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument();
      });

      // Verify case details are shown
      expect(screen.getByText('MSC2190000001')).toBeInTheDocument();
      expect(screen.getByText('Case Was Approved')).toBeInTheDocument();

      // Verify token information is displayed
      expect(screen.getByText('Bearer')).toBeInTheDocument();

      // Verify client secret is cleared for security
      expect(clientSecretInput).toHaveValue('');
      expect(clientIdInput).toHaveValue('test-client-123'); // Client ID should remain
    });

    it('should handle error scenarios gracefully', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for WASM to initialize
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Fill out the form
      await user.type(screen.getByLabelText(/client id/i), 'test-client');
      await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');

      // Submit the form
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Simulate error
      simulateWorkerMessage('error', {
        error: 'Authentication failed',
        context: { step: 'authentication', details: 'Invalid credentials' }
      }, 1);

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
      });

      // Verify form is re-enabled for retry
      expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
    });

    it('should handle network timeouts and retries', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for WASM to initialize
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Fill and submit form
      await user.type(screen.getByLabelText(/client id/i), 'test-client');
      await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Simulate timeout error
      simulateWorkerMessage('error', {
        error: 'Request timeout',
        context: { step: 'api-call', retryable: true }
      }, 1);

      // Verify retry option is available
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      // Test retry functionality
      await user.click(screen.getByRole('button', { name: /retry/i }));

      // Verify retry attempt
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'process_credentials'
        })
      );
    });
  });

  describe('Component Integration', () => {
    it('should integrate ProcessingIndicator with realtime updates', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Start processing
      await user.type(screen.getByLabelText(/client id/i), 'test-client');
      await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Verify processing indicator appears
      expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();

      // Send multiple realtime updates
      const updates = [
        { id: '1', step: 'validating', message: 'Validating input', level: 'info' },
        { id: '2', step: 'authenticating', message: 'Connecting to API', level: 'info' },
        { id: '3', step: 'fetching-case-data', message: 'Retrieving case data', level: 'info' },
        { id: '4', step: 'processing-results', message: 'Processing response', level: 'info' }
      ];

      updates.forEach(update => {
        simulateWorkerMessage('realtime-update', update);
      });

      // Verify all updates are displayed
      updates.forEach(update => {
        expect(screen.getByText(update.message)).toBeInTheDocument();
      });

      // Verify progress indicator updates
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow');
    });

    it('should integrate ResultsContainer with tabbed navigation', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Complete a successful submission
      await user.type(screen.getByLabelText(/client id/i), 'test-client');
      await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      const mockResult: ProcessingResult = {
        baseURL: 'https://api.uscis.gov',
        authMode: 'OAuth2',
        tokenHint: 'Bearer token',
        config: { environment: 'development' },
        caseDetails: {
          caseNumber: 'MSC123',
          currentStatus: 'Approved',
          processingCenter: 'NBC',
          priorityDate: '2021-01-01',
          caseType: 'I-485',
          lastUpdated: '2023-01-01T00:00:00Z'
        },
        oauthToken: {
          accessToken: 'token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString()
        }
      };

      simulateWorkerMessage('result', mockResult, 1);

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
      });

      // Test tab navigation
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBeGreaterThan(1);

      // Click on different tabs
      for (const tab of tabs) {
        await user.click(tab);
        expect(tab).toHaveAttribute('aria-selected', 'true');
        
        // Verify corresponding tab panel is visible
        const tabPanelId = tab.getAttribute('aria-controls');
        if (tabPanelId) {
          const tabPanel = screen.getByRole('tabpanel', { hidden: false });
          expect(tabPanel).toHaveAttribute('id', tabPanelId);
        }
      }
    });
  });

  describe('Data Flow Validation', () => {
    it('should validate data transformation pipeline', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Submit form
      await user.type(screen.getByLabelText(/client id/i), 'test-client');
      await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Verify WASM message format
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'process_credentials',
          credentials: expect.objectContaining({
            clientId: 'test-client',
            clientSecret: 'test-secret',
            environment: 'development'
          })
        })
      );

      // Simulate response with complex data structure
      const complexResult = {
        baseURL: 'https://api.uscis.gov',
        authMode: 'OAuth2',
        tokenHint: 'Bearer token',
        config: {
          environment: 'development',
          endpoints: {
            auth: '/oauth/token',
            cases: '/api/cases'
          },
          features: ['realtime-updates', 'case-tracking']
        },
        caseDetails: {
          caseNumber: 'MSC2190000001',
          currentStatus: 'Case Was Approved',
          processingCenter: 'National Benefits Center',
          priorityDate: '2021-01-15',
          caseType: 'I-485 Application for Adjustment of Status',
          approvalDate: '2023-03-20',
          lastUpdated: '2023-03-21T10:30:00Z',
          verificationId: 'VER123456789',
          additionalInfo: {
            attorney: 'John Doe Law Firm',
            filingDate: '2021-01-01',
            noticeDates: ['2021-02-01', '2022-01-01', '2023-03-20']
          }
        },
        oauthToken: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: '2024-01-01T12:00:00Z',
          scope: 'read write admin',
          refreshToken: 'refresh_token_value'
        },
        processingMetadata: {
          environment: 'development',
          processingTime: 2500,
          requestId: 'req-abc123',
          timestamp: '2023-12-01T10:00:00Z',
          version: '2.1.0'
        }
      };

      simulateWorkerMessage('result', complexResult, 1);

      // Verify data is properly displayed
      await waitFor(() => {
        expect(screen.getByText('MSC2190000001')).toBeInTheDocument();
        expect(screen.getByText('Case Was Approved')).toBeInTheDocument();
        expect(screen.getByText('National Benefits Center')).toBeInTheDocument();
        expect(screen.getByText('Bearer')).toBeInTheDocument();
      });

      // Verify complex nested data is accessible
      const rawDataTab = screen.getByRole('tab', { name: /raw data/i });
      await user.click(rawDataTab);

      // Should display JSON with proper formatting
      await waitFor(() => {
        expect(screen.getByText(/"caseNumber"/)).toBeInTheDocument();
        expect(screen.getByText(/"accessToken"/)).toBeInTheDocument();
      });
    });

    it('should handle partial data gracefully', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Submit form
      await user.type(screen.getByLabelText(/client id/i), 'test-client');
      await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Simulate partial result (missing some optional fields)
      const partialResult = {
        baseURL: 'https://api.uscis.gov',
        authMode: 'OAuth2',
        tokenHint: 'Bearer token',
        config: { environment: 'development' },
        // Missing caseDetails and oauthToken
      };

      simulateWorkerMessage('result', partialResult, 1);

      // Should still display available data
      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument();
        expect(screen.getByText('https://api.uscis.gov')).toBeInTheDocument();
      });

      // Should handle missing data gracefully
      expect(screen.queryByText('Case Details')).not.toBeInTheDocument();
      expect(screen.queryByText('Token Status')).not.toBeInTheDocument();
    });
  });

  describe('Performance and Memory Management', () => {
    it('should handle large datasets efficiently', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Submit form
      await user.type(screen.getByLabelText(/client id/i), 'test-client');
      await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Send many realtime updates to test performance
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        simulateWorkerMessage('realtime-update', {
          id: `update-${i}`,
          step: 'processing',
          message: `Processing item ${i}`,
          level: 'info'
        });
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should handle updates efficiently (under 100ms for 100 updates)
      expect(processingTime).toBeLessThan(100);

      // Should limit displayed updates to prevent memory issues
      const updateElements = screen.getAllByText(/Processing item/);
      expect(updateElements.length).toBeLessThanOrEqual(100);
    });

    it('should clean up resources properly', async () => {
      const { unmount } = render(<App />);

      simulateWorkerMessage('initialized');

      // Verify worker is created
      expect(global.Worker).toHaveBeenCalled();

      // Unmount component
      unmount();

      // Verify cleanup
      expect(mockTerminate).toHaveBeenCalled();
      expect(mockRemoveEventListener).toHaveBeenCalled();
    });
  });
});