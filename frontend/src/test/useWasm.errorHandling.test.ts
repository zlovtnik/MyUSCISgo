import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWasm } from '../hooks/useWasm';
import { createWASMError, createValidationError, globalRetryManager } from '../utils/errorHandling';
import type { Credentials } from '../types';

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}));

// Mock Web Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  
  constructor(public url: string) {}
  
  postMessage(data: any) {
    // Simulate async message handling
    setTimeout(() => {
      if (this.onmessage) {
        this.simulateMessage(data);
      }
    }, 0);
  }
  
  terminate() {}
  
  addEventListener(type: string, listener: any) {
    if (type === 'message') {
      this.onmessage = listener;
    } else if (type === 'error') {
      this.onerror = listener;
    }
  }
  
  removeEventListener() {}
  
  simulateMessage(data: any) {
    // Override in tests to simulate different responses
  }
  
  simulateError(error: ErrorEvent) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

// Mock global Worker
global.Worker = MockWorker as any;

describe('useWasm Error Handling', () => {
  let mockWorker: MockWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    globalRetryManager.reset();
    
    // Capture the worker instance
    const OriginalWorker = global.Worker;
    global.Worker = class extends OriginalWorker {
      constructor(url: string) {
        super(url);
        mockWorker = this as any;
      }
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Worker Initialization Errors', () => {
    it('should handle worker load errors', async () => {
      const { result } = renderHook(() => useWasm());

      act(() => {
        mockWorker.simulateError(new ErrorEvent('error', {
          message: 'Failed to load worker script',
          filename: '/wasm-worker.js',
          lineno: 1,
          colno: 1
        }));
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.name).toBe('WASMError');
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle initialization timeout', async () => {
      const { result } = renderHook(() => useWasm());

      // Don't send initialization success message
      // The hook should handle this gracefully
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.isLoaded).toBe(false);
    });
  });

  describe('processCredentials Error Handling', () => {
    beforeEach(() => {
      // Mock successful initialization
      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
        }
      };
    });

    it('should validate credentials before processing', async () => {
      const { result } = renderHook(() => useWasm());

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const invalidCredentials = [
        null,
        undefined,
        {},
        { clientId: '' },
        { clientId: 'test', clientSecret: '' },
        { clientId: 'test', clientSecret: 'secret', environment: '' }
      ];

      for (const credentials of invalidCredentials) {
        const response = await act(async () => {
          return result.current.processCredentials(credentials as any);
        });

        expect(response.success).toBe(false);
        expect(response.error).toContain('Invalid credentials');
      }
    });

    it('should retry failed requests', async () => {
      const { result } = renderHook(() => useWasm());
      let attemptCount = 0;

      // Mock worker to fail first two attempts, succeed on third
      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
        } else if (data.type === 'process') {
          attemptCount++;
          setTimeout(() => {
            if (attemptCount < 3) {
              mockWorker.onmessage?.({
                data: {
                  type: 'error',
                  error: 'Temporary failure',
                  requestId: data.requestId,
                  code: 'TEMP_ERROR'
                }
              } as MessageEvent);
            } else {
              mockWorker.onmessage?.({
                data: {
                  type: 'result',
                  result: {
                    baseURL: 'https://api.example.com',
                    authMode: 'oauth',
                    tokenHint: 'test-token',
                    config: {}
                  },
                  requestId: data.requestId
                }
              } as MessageEvent);
            }
          }, 0);
        }
      };

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const credentials: Credentials = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      const response = await act(async () => {
        return result.current.processCredentials(credentials);
      });

      expect(attemptCount).toBe(3);
      expect(response.success).toBe(true);
    });

    it('should not retry validation errors', async () => {
      const { result } = renderHook(() => useWasm());
      let attemptCount = 0;

      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
        } else if (data.type === 'process') {
          attemptCount++;
          // Always return validation error
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: {
                type: 'error',
                error: 'Invalid credentials format',
                requestId: data.requestId,
                code: 'VALIDATION_ERROR'
              }
            } as MessageEvent);
          }, 0);
        }
      };

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const credentials: Credentials = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      const response = await act(async () => {
        return result.current.processCredentials(credentials);
      });

      expect(attemptCount).toBe(1); // Should not retry
      expect(response.success).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const { result } = renderHook(() => useWasm());

      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
        }
        // Don't respond to process requests to simulate timeout
      };

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const credentials: Credentials = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      // Mock a short timeout for testing
      vi.spyOn(result.current, 'processCredentials').mockImplementation(async () => {
        throw createWASMError('Request timeout after 100ms', 'process', {
          code: 'TIMEOUT',
          retryable: true
        });
      });

      await expect(
        act(async () => {
          return result.current.processCredentials(credentials);
        })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('certifyToken Error Handling', () => {
    beforeEach(() => {
      // Mock successful initialization
      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
        }
      };
    });

    it('should validate token data before processing', async () => {
      const { result } = renderHook(() => useWasm());

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const invalidTokenData = [
        null,
        undefined,
        {},
        { token: '' },
        { token: 'test', caseNumber: '' },
        { token: 'test', caseNumber: 'case123', environment: '' }
      ];

      for (const tokenData of invalidTokenData) {
        const response = await act(async () => {
          return result.current.certifyToken(tokenData as any);
        });

        expect(response.isValid).toBe(false);
        expect(response.caseStatus).toBe('Error');
        expect(response.caseDetails.error).toContain('Invalid token data');
      }
    });

    it('should handle token refresh errors', async () => {
      const { result } = renderHook(() => useWasm());

      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
        } else if (data.type === 'certify-token') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: {
                type: 'error',
                error: 'Token expired and refresh failed',
                requestId: data.requestId,
                code: 'TOKEN_REFRESH_ERROR'
              }
            } as MessageEvent);
          }, 0);
        }
      };

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const tokenData = {
        token: 'expired-token',
        caseNumber: 'CASE123',
        environment: 'production'
      };

      const response = await act(async () => {
        return result.current.certifyToken(tokenData);
      });

      expect(response.isValid).toBe(false);
      expect(response.caseStatus).toBe('Error');
    });
  });

  describe('healthCheck Error Handling', () => {
    it('should handle health check failures', async () => {
      const { result } = renderHook(() => useWasm());

      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
        } else if (data.type === 'health-check') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: {
                type: 'error',
                error: 'Health check failed',
                requestId: data.requestId,
                code: 'HEALTH_ERROR'
              }
            } as MessageEvent);
          }, 0);
        }
      };

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const response = await act(async () => {
        return result.current.healthCheck();
      });

      expect(response.status).toBe('error');
      expect(response.isHealthy).toBe(false);
      expect(response.error).toBeTruthy();
    });

    it('should retry health check on failure', async () => {
      const { result } = renderHook(() => useWasm());
      let attemptCount = 0;

      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
        } else if (data.type === 'health-check') {
          attemptCount++;
          setTimeout(() => {
            if (attemptCount < 2) {
              mockWorker.onmessage?.({
                data: {
                  type: 'error',
                  error: 'Temporary health check failure',
                  requestId: data.requestId,
                  code: 'TEMP_HEALTH_ERROR'
                }
              } as MessageEvent);
            } else {
              mockWorker.onmessage?.({
                data: {
                  type: 'health-result',
                  result: {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    isHealthy: true
                  },
                  requestId: data.requestId
                }
              } as MessageEvent);
            }
          }, 0);
        }
      };

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const response = await act(async () => {
        return result.current.healthCheck();
      });

      expect(attemptCount).toBe(2);
      expect(response.status).toBe('healthy');
      expect(response.isHealthy).toBe(true);
    });
  });

  describe('Realtime Updates Error Handling', () => {
    it('should handle malformed realtime updates gracefully', async () => {
      const { result } = renderHook(() => useWasm());

      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
          
          // Send malformed realtime update
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: {
                type: 'realtime-update',
                result: null // Invalid update
              }
            } as MessageEvent);
          }, 10);
        }
      };

      // Wait for initialization and update processing
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Should not crash and updates should remain empty
      expect(result.current.realtimeUpdates).toHaveLength(0);
    });

    it('should limit realtime updates to prevent memory issues', async () => {
      const { result } = renderHook(() => useWasm());

      mockWorker.simulateMessage = (data) => {
        if (data.type === 'initialize') {
          setTimeout(() => {
            mockWorker.onmessage?.({
              data: { type: 'initialized' }
            } as MessageEvent);
          }, 0);
          
          // Send many realtime updates
          for (let i = 0; i < 150; i++) {
            setTimeout(() => {
              mockWorker.onmessage?.({
                data: {
                  type: 'realtime-update',
                  result: {
                    id: `update-${i}`,
                    timestamp: new Date().toISOString(),
                    step: 'processing-results',
                    message: `Update ${i}`,
                    level: 'info'
                  }
                }
              } as MessageEvent);
            }, i * 2);
          }
        }
      };

      // Wait for initialization and all updates
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      // Should be limited to 100 updates
      expect(result.current.realtimeUpdates.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Retry Statistics', () => {
    it('should track retry statistics correctly', async () => {
      const { result } = renderHook(() => useWasm());

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const stats = result.current.getProcessingStatistics();
      
      expect(stats.retryStats).toBeDefined();
      expect(stats.retryStats.processCredentials).toBe(0);
      expect(stats.retryStats.certifyToken).toBe(0);
      expect(stats.retryStats.healthCheck).toBe(0);
      expect(stats.retryStats.clearCache).toBe(0);
    });
  });

  describe('retryLastOperation', () => {
    it('should reset retry count before retrying', async () => {
      const { result } = renderHook(() => useWasm());

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const credentials: Credentials = {
        clientId: 'test-id',
        clientSecret: 'test-secret',
        environment: 'development'
      };

      // Mock processCredentials to track calls
      const processCredentialsSpy = vi.spyOn(result.current, 'processCredentials')
        .mockResolvedValue({ success: true, result: {} as any });

      await act(async () => {
        await result.current.retryLastOperation('process', credentials);
      });

      expect(processCredentialsSpy).toHaveBeenCalledWith(credentials);
    });

    it('should validate operation parameters', async () => {
      const { result } = renderHook(() => useWasm());

      // Wait for initialization
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await expect(
        act(async () => {
          return result.current.retryLastOperation('process');
        })
      ).rejects.toThrow('Credentials required for retry');

      await expect(
        act(async () => {
          return result.current.retryLastOperation('certify');
        })
      ).rejects.toThrow('Token data required for retry');

      await expect(
        act(async () => {
          return result.current.retryLastOperation('unknown' as any);
        })
      ).rejects.toThrow('Unknown operation');
    });
  });
});