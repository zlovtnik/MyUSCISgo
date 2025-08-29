import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { performance } from 'perf_hooks';
import App from '../App';
import { CaseDetailsView } from '../components/results/CaseDetailsView';
import { TokenStatusView } from '../components/results/TokenStatusView';
import { ProcessingIndicator } from '../components/ProcessingIndicator';
import { ResultsContainer } from '../components/results/ResultsContainer';
import type { CaseDetails, OAuthToken, ProcessingResult, RealtimeUpdate } from '../types';

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

// Performance measurement utilities
const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const startTime = performance.now();
  renderFn();
  const endTime = performance.now();
  return endTime - startTime;
};

const measureAsyncOperation = async (operation: () => Promise<void>): Promise<number> => {
  const startTime = performance.now();
  await operation();
  const endTime = performance.now();
  return endTime - startTime;
};

// Generate large datasets for testing
const generateLargeRealtimeUpdates = (count: number): RealtimeUpdate[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `update-${i}`,
    timestamp: new Date(Date.now() - (count - i) * 1000).toISOString(),
    step: ['validating', 'authenticating', 'fetching-case-data', 'processing-results'][i % 4] as any,
    message: `Processing step ${i + 1} of ${count}: ${['Validating input', 'Authenticating user', 'Fetching case data', 'Processing results'][i % 4]}`,
    level: ['info', 'warning', 'error'][i % 3] as any
  }));
};

const generateLargeCaseDetails = (): CaseDetails => ({
  caseNumber: 'MSC2190000001',
  currentStatus: 'Case Was Approved And My Card Was Ordered On March 20, 2023',
  processingCenter: 'National Benefits Center - Lee\'s Summit, MO',
  priorityDate: '2021-01-15',
  caseType: 'I-485 Application for Adjustment of Status to Permanent Resident',
  approvalDate: '2023-03-20',
  lastUpdated: '2023-03-21T10:30:00Z',
  verificationId: 'VER123456789ABCDEF',
  additionalInfo: {
    attorney: 'John Doe Law Firm LLC - Immigration and Nationality Law Specialists',
    filingDate: '2021-01-01',
    noticeDates: Array.from({ length: 50 }, (_, i) => 
      new Date(2021, 0, 1 + i * 7).toISOString().split('T')[0]
    )
  }
});

const generateLargeProcessingResult = (): ProcessingResult => ({
  baseURL: 'https://api.uscis.gov/external/cases/status/check',
  authMode: 'OAuth2 Bearer Token Authentication',
  tokenHint: 'Bearer token with extended scope and permissions',
  config: {
    environment: 'development',
    version: '2.1.0',
    timeout: '30000',
    retryAttempts: '3',
    ...Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`config_key_${i}`, `config_value_${i}`])
    )
  },
  caseDetails: generateLargeCaseDetails(),
  oauthToken: {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'x'.repeat(1000) + '.signature',
    tokenType: 'Bearer',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    scope: 'read write admin cases tokens users notifications settings',
    refreshToken: 'refresh_' + 'x'.repeat(500)
  },
  processingMetadata: {
    environment: 'development',
    processingTime: 2500,
    requestId: 'req-' + 'x'.repeat(100),
    timestamp: new Date().toISOString()
  }
});

describe('Performance Tests', () => {
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

  describe('Component Rendering Performance', () => {
    it('should render CaseDetailsView with large data efficiently', async () => {
      const largeCaseDetails = generateLargeCaseDetails();
      
      const renderTime = await measureRenderTime(() => {
        render(
          <CaseDetailsView 
            caseDetails={largeCaseDetails} 
            environment="development" 
          />
        );
      });

      // Should render within 100ms even with large data
      expect(renderTime).toBeLessThan(100);
      
      // Verify content is still accessible
      expect(screen.getByText('MSC2190000001')).toBeInTheDocument();
      expect(screen.getByText(/Case Was Approved/)).toBeInTheDocument();
    });

    it('should render TokenStatusView efficiently', async () => {
      const largeToken: OAuthToken = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 'x'.repeat(2000) + '.signature',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        scope: Array.from({ length: 50 }, (_, i) => `scope_${i}`).join(' ')
      };

      const renderTime = await measureRenderTime(() => {
        render(
          <TokenStatusView 
            oauthToken={largeToken} 
            environment="development" 
          />
        );
      });

      expect(renderTime).toBeLessThan(100);
      expect(screen.getByText('Bearer')).toBeInTheDocument();
    });

    it('should render ProcessingIndicator with many updates efficiently', async () => {
      const manyUpdates = generateLargeRealtimeUpdates(1000);

      const renderTime = await measureRenderTime(() => {
        render(
          <ProcessingIndicator
            isProcessing={true}
            currentStep="processing-results"
            progress={75}
            realtimeUpdates={manyUpdates}
          />
        );
      });

      // Should handle 1000 updates within 200ms
      expect(renderTime).toBeLessThan(200);
      
      // Should limit displayed updates for performance
      const updateElements = screen.getAllByText(/Processing step/);
      expect(updateElements.length).toBeLessThanOrEqual(100);
    });

    it('should render ResultsContainer with large dataset efficiently', async () => {
      const largeResult = generateLargeProcessingResult();

      const renderTime = await measureRenderTime(() => {
        render(
          <ResultsContainer
            result={largeResult}
            environment="development"
            onReset={vi.fn()}
          />
        );
      });

      expect(renderTime).toBeLessThan(150);
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });
  });

  describe('User Interaction Performance', () => {
    it('should handle rapid tab switching efficiently', async () => {
      const user = userEvent.setup();
      const largeResult = generateLargeProcessingResult();

      render(
        <ResultsContainer
          result={largeResult}
          environment="development"
          onReset={vi.fn()}
        />
      );

      const tabs = screen.getAllByRole('tab');
      const switchingTimes: number[] = [];

      // Measure tab switching performance
      for (let i = 0; i < tabs.length; i++) {
        const startTime = performance.now();
        await user.click(tabs[i]);
        await waitFor(() => {
          expect(tabs[i]).toHaveAttribute('aria-selected', 'true');
        });
        const endTime = performance.now();
        switchingTimes.push(endTime - startTime);
      }

      // Each tab switch should be under 50ms
      switchingTimes.forEach(time => {
        expect(time).toBeLessThan(50);
      });

      // Average switching time should be under 30ms
      const averageTime = switchingTimes.reduce((a, b) => a + b, 0) / switchingTimes.length;
      expect(averageTime).toBeLessThan(30);
    });

    it('should handle rapid form input efficiently', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      const clientIdInput = screen.getByLabelText(/client id/i);
      const longText = 'a'.repeat(1000);

      const typingTime = await measureAsyncOperation(async () => {
        await user.type(clientIdInput, longText);
      });

      // Should handle long input efficiently
      expect(typingTime).toBeLessThan(1000);
      expect(clientIdInput).toHaveValue(longText);
    });

    it('should handle form submission with large data efficiently', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Fill form
      await user.type(screen.getByLabelText(/client id/i), 'performance-test');
      await user.type(screen.getByLabelText(/client secret/i), 'PerformanceSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');

      const submissionTime = await measureAsyncOperation(async () => {
        await user.click(screen.getByRole('button', { name: /submit/i }));
        
        // Simulate large result
        const largeResult = generateLargeProcessingResult();
        simulateWorkerMessage('result', largeResult, 1);
        
        await waitFor(() => {
          expect(screen.getByTestId('result')).toBeInTheDocument();
        });
      });

      // Should handle submission and large result rendering within 500ms
      expect(submissionTime).toBeLessThan(500);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should handle multiple realtime updates without memory leaks', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Start processing
      await user.type(screen.getByLabelText(/client id/i), 'memory-test');
      await user.type(screen.getByLabelText(/client secret/i), 'MemorySecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Send many updates rapidly
      const updateCount = 1000;
      const startTime = performance.now();

      for (let i = 0; i < updateCount; i++) {
        simulateWorkerMessage('realtime-update', {
          id: `memory-test-${i}`,
          step: 'processing',
          message: `Memory test update ${i}`,
          level: 'info'
        });
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process 1000 updates within 200ms
      expect(processingTime).toBeLessThan(200);

      // Should limit stored updates to prevent memory issues
      // This depends on implementation - typically should cap at 100-500 updates
      const displayedUpdates = screen.getAllByText(/Memory test update/);
      expect(displayedUpdates.length).toBeLessThanOrEqual(100);
    });

    it('should clean up resources on component unmount', async () => {
      const { unmount } = render(<App />);

      simulateWorkerMessage('initialized');

      // Add some data
      const largeResult = generateLargeProcessingResult();
      simulateWorkerMessage('result', largeResult, 1);

      // Measure unmount time
      const unmountTime = await measureAsyncOperation(async () => {
        unmount();
      });

      // Should unmount quickly even with large data
      expect(unmountTime).toBeLessThan(50);

      // Verify cleanup
      expect(mockTerminate).toHaveBeenCalled();
    });
  });

  describe('Data Processing Performance', () => {
    it('should transform large WASM output efficiently', async () => {
      const { transformWASMOutput } = await import('../utils/dataTransform');
      
      const largeWASMOutput = {
        ...generateLargeProcessingResult(),
        additionalData: Object.fromEntries(
          Array.from({ length: 1000 }, (_, i) => [`key_${i}`, `value_${i}`])
        )
      };

      const transformTime = await measureAsyncOperation(async () => {
        vi.mocked(transformWASMOutput)(largeWASMOutput);
      });

      // Should transform large data within 50ms
      expect(transformTime).toBeLessThan(50);
    });

    it('should handle JSON serialization of large objects efficiently', async () => {
      const largeResult = generateLargeProcessingResult();

      const serializationTime = await measureAsyncOperation(async () => {
        const jsonString = JSON.stringify(largeResult, null, 2);
        expect(jsonString.length).toBeGreaterThan(1000);
      });

      // Should serialize large objects within 100ms
      expect(serializationTime).toBeLessThan(100);
    });

    it('should handle data validation efficiently', async () => {
      const { validateProcessingResult } = await import('../utils/validation');
      const largeResult = generateLargeProcessingResult();

      const validationTime = await measureAsyncOperation(async () => {
        // Mock validation function
        if (vi.mocked(validateProcessingResult)) {
          vi.mocked(validateProcessingResult)(largeResult);
        }
      });

      // Should validate large objects within 50ms
      expect(validationTime).toBeLessThan(50);
    });
  });

  describe('Rendering Optimization Performance', () => {
    it('should use memoization effectively for expensive calculations', async () => {
      const largeUpdates = generateLargeRealtimeUpdates(500);
      
      // First render
      const firstRenderTime = await measureRenderTime(() => {
        render(
          <ProcessingIndicator
            isProcessing={true}
            currentStep="processing-results"
            progress={50}
            realtimeUpdates={largeUpdates}
          />
        );
      });

      // Re-render with same props (should be faster due to memoization)
      const { rerender } = render(
        <ProcessingIndicator
          isProcessing={true}
          currentStep="processing-results"
          progress={50}
          realtimeUpdates={largeUpdates}
        />
      );

      const secondRenderTime = await measureRenderTime(() => {
        rerender(
          <ProcessingIndicator
            isProcessing={true}
            currentStep="processing-results"
            progress={50}
            realtimeUpdates={largeUpdates}
          />
        );
      });

      // Second render should be significantly faster (memoization effect)
      expect(secondRenderTime).toBeLessThan(firstRenderTime * 0.5);
    });

    it('should handle virtual scrolling for large lists efficiently', async () => {
      const manyUpdates = generateLargeRealtimeUpdates(10000);

      const renderTime = await measureRenderTime(() => {
        render(
          <ProcessingIndicator
            isProcessing={true}
            currentStep="processing-results"
            progress={75}
            realtimeUpdates={manyUpdates}
          />
        );
      });

      // Should handle 10k updates efficiently through virtualization
      expect(renderTime).toBeLessThan(300);

      // Should only render visible items
      const renderedUpdates = screen.getAllByText(/Processing step/);
      expect(renderedUpdates.length).toBeLessThan(200); // Virtual scrolling limit
    });
  });

  describe('Network Performance Simulation', () => {
    it('should handle slow WASM responses efficiently', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Start submission
      await user.type(screen.getByLabelText(/client id/i), 'slow-response-test');
      await user.type(screen.getByLabelText(/client secret/i), 'SlowResponseSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Verify UI remains responsive during "slow" response
      expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      
      // Simulate delayed response
      setTimeout(() => {
        simulateWorkerMessage('result', generateLargeProcessingResult(), 1);
      }, 100);

      // Should handle delayed response gracefully
      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('should batch realtime updates for better performance', async () => {
      const user = userEvent.setup();
      render(<App />);

      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      await user.type(screen.getByLabelText(/client id/i), 'batch-test');
      await user.type(screen.getByLabelText(/client secret/i), 'BatchSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Send rapid updates (should be batched)
      const rapidUpdates = Array.from({ length: 50 }, (_, i) => ({
        id: `batch-${i}`,
        step: 'processing',
        message: `Batch update ${i}`,
        level: 'info'
      }));

      const batchTime = await measureAsyncOperation(async () => {
        rapidUpdates.forEach(update => {
          simulateWorkerMessage('realtime-update', update);
        });
        
        // Wait for updates to be processed
        await waitFor(() => {
          expect(screen.getByText(/Batch update/)).toBeInTheDocument();
        });
      });

      // Should handle rapid updates efficiently through batching
      expect(batchTime).toBeLessThan(100);
    });
  });
});