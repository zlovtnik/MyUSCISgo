import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWasm } from '../hooks/useWasm';
import type { Credentials } from '../types';

// Mock the data transform utilities
vi.mock('../utils/dataTransform', () => ({
  transformWASMOutput: vi.fn((input) => ({
    baseURL: input.baseURL || '',
    authMode: input.authMode || '',
    tokenHint: input.tokenHint || '',
    config: input.config || {},
    oauthToken: input.oauthToken,
    caseDetails: input.caseDetails,
    processingMetadata: input.processingMetadata
  })),
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

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  }
}));

describe('useWasm enhanced functionality', () => {
  let mockWorker: any;
  let mockPostMessage: any;
  let mockTerminate: any;
  let mockAddEventListener: any;
  let mockRemoveEventListener: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPostMessage = vi.fn();
    mockTerminate = vi.fn();
    mockAddEventListener = vi.fn();
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
    const messageHandler = mockAddEventListener.mock.calls.find(
      call => call[0] === 'message'
    )?.[1];
    
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

  describe('enhanced processCredentials', () => {
    it('should validate credentials before processing', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Test with invalid credentials
      const invalidCredentials = null as any;
      
      const response = await act(async () => {
        return await result.current.processCredentials(invalidCredentials);
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid credentials');
    });

    it('should clear realtime updates when starting new processing', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Add some realtime updates first
      act(() => {
        simulateWorkerMessage('realtime-update', {
          id: 'test-1',
          message: 'Test update'
        });
      });

      expect(result.current.realtimeUpdates).toHaveLength(1);

      // Process credentials
      const validCredentials: Credentials = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      act(() => {
        result.current.processCredentials(validCredentials);
      });

      // Realtime updates should be cleared
      expect(result.current.realtimeUpdates).toHaveLength(0);
    });

    it('should handle enhanced WASM response with transformation', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const validCredentials: Credentials = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      const processPromise = act(async () => {
        return result.current.processCredentials(validCredentials);
      });

      // Simulate enhanced WASM response
      const enhancedResponse = {
        baseURL: 'https://api.example.com',
        authMode: 'oauth',
        tokenHint: 'Bearer token',
        config: { key: 'value' },
        oauthToken: {
          accessToken: 'test-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: '2024-01-01T00:00:00Z'
        },
        caseDetails: {
          currentStatus: 'Approved',
          processingCenter: 'NBC',
          priorityDate: '2023-01-01',
          caseType: 'I-485',
          lastUpdated: '2024-01-01T00:00:00Z'
        }
      };

      act(() => {
        simulateWorkerMessage('result', enhancedResponse, 1);
      });

      const response = await processPromise;

      expect(response.success).toBe(true);
      expect(response.result?.oauthToken).toBeDefined();
      expect(response.result?.caseDetails).toBeDefined();
    });

    it('should handle transformation errors gracefully', async () => {
      const { result } = renderHook(() => useWasm());

      // Mock transformation to throw error
      const { transformWASMOutput } = await import('../utils/dataTransform');
      vi.mocked(transformWASMOutput).mockImplementationOnce(() => {
        throw new Error('Transformation failed');
      });

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const validCredentials: Credentials = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      const processPromise = act(async () => {
        return result.current.processCredentials(validCredentials);
      });

      act(() => {
        simulateWorkerMessage('result', { baseURL: 'test' }, 1);
      });

      const response = await processPromise;

      expect(response.success).toBe(true);
      // Should fallback to basic structure
      expect(response.result?.baseURL).toBe('test');
    });
  });

  describe('enhanced certifyToken', () => {
    it('should validate token data before processing', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Test with invalid token data
      const invalidTokenData = { token: '' } as any;
      
      const response = await result.current.certifyToken(invalidTokenData);

      expect(response.isValid).toBe(false);
      expect(response.caseDetails.error).toContain('Invalid token data');
    });

    it('should enhance certification results', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const validTokenData = {
        token: 'test-token',
        caseNumber: 'MSC123456789',
        environment: 'development'
      };

      const certifyPromise = act(async () => {
        return result.current.certifyToken(validTokenData);
      });

      const certificationResponse = {
        isValid: true,
        caseStatus: 'Approved',
        lastUpdated: '2024-01-01T00:00:00Z',
        caseDetails: { status: 'approved' },
        verificationId: 'ver-123'
      };

      act(() => {
        simulateWorkerMessage('certify-result', certificationResponse, 1);
      });

      const response = await certifyPromise;

      expect(response.isValid).toBe(true);
      expect(response.caseStatus).toBe('Approved');
      expect(response.verificationId).toBe('ver-123');
    });
  });

  describe('enhanced realtime updates', () => {
    it('should transform and validate realtime updates', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Send realtime update
      act(() => {
        simulateWorkerMessage('realtime-update', {
          id: 'update-1',
          timestamp: '2024-01-01T00:00:00Z',
          step: 'validating',
          message: 'Validating credentials',
          level: 'info'
        });
      });

      expect(result.current.realtimeUpdates).toHaveLength(1);
      expect(result.current.realtimeUpdates[0].id).toBe('update-1');
    });

    it('should prevent duplicate updates', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const updateData = {
        id: 'update-1',
        message: 'Test update'
      };

      // Send same update twice
      act(() => {
        simulateWorkerMessage('realtime-update', updateData);
        simulateWorkerMessage('realtime-update', updateData);
      });

      expect(result.current.realtimeUpdates).toHaveLength(1);
    });

    it('should limit update history to 100 items', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Send 105 updates
      act(() => {
        for (let i = 0; i < 105; i++) {
          simulateWorkerMessage('realtime-update', {
            id: `update-${i}`,
            message: `Update ${i}`
          });
        }
      });

      expect(result.current.realtimeUpdates).toHaveLength(100);
      // Should keep the latest updates
      expect(result.current.realtimeUpdates[99].id).toBe('update-104');
    });
  });

  describe('enhanced error handling', () => {
    it('should provide enhanced error context', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const validCredentials: Credentials = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      const processPromise = act(async () => {
        return result.current.processCredentials(validCredentials);
      });

      // Simulate error with context
      act(() => {
        simulateWorkerMessage('error', {
          error: 'Processing failed',
          context: { step: 'authentication', details: 'Invalid credentials' }
        }, 1);
      });

      try {
        await processPromise;
      } catch (error: any) {
        expect(error.message).toBe('Processing failed');
        expect(error.name).toBe('WASMError');
        expect(error.context).toBeDefined();
      }
    });
  });

  describe('utility functions', () => {
    it('should provide processing statistics', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      // Add some updates with unique IDs to prevent deduplication
      act(() => {
        simulateWorkerMessage('realtime-update', { id: 'update-1', level: 'info' });
        simulateWorkerMessage('realtime-update', { id: 'update-2', level: 'warning' });
        simulateWorkerMessage('realtime-update', { id: 'update-3', level: 'info' });
      });

      const stats = result.current.getProcessingStatistics();

      expect(stats.totalUpdates).toBe(3);
      expect(stats.updatesByLevel.info).toBe(2);
      expect(stats.updatesByLevel.warning).toBe(1);
      expect(stats.isHealthy).toBe(true);
    });

    it('should support retry operations', async () => {
      const { result } = renderHook(() => useWasm());

      // Initialize the worker
      act(() => {
        simulateWorkerMessage('initialized');
      });

      await waitFor(() => {
        expect(result.current.isLoaded).toBe(true);
      });

      const credentials: Credentials = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      // Test retry for process operation
      const retryPromise = act(async () => {
        return result.current.retryLastOperation('process', credentials);
      });

      act(() => {
        simulateWorkerMessage('result', {
          baseURL: 'https://api.example.com',
          authMode: 'oauth',
          tokenHint: 'Bearer token',
          config: {}
        }, 1);
      });

      const response = await retryPromise;
      expect(response.success).toBe(true);
    });
  });
});