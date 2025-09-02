import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEnhancedError,
  createWASMError,
  createNetworkError,
  createValidationError,
  createTokenRefreshError,
  RetryManager,
  globalRetryManager,
  isRetryableError,
  getUserFriendlyErrorMessage,
  logError,
  withTimeout
} from '../utils/errorHandling';

describe('Error Handling Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalRetryManager.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createEnhancedError', () => {
    it('should create an enhanced error with all properties', () => {
      const error = createEnhancedError(
        'Test error message',
        'wasm-processing',
        {
          retryable: true,
          userMessage: 'User friendly message',
          context: { testKey: 'testValue' }
        }
      );

      expect(error.message).toBe('Test error message');
      expect(error.category).toBe('wasm-processing');
      expect(error.retryable).toBe(true);
      expect(error.userMessage).toBe('User friendly message');
      expect(error.technicalDetails).toBe('Test error message');
      expect(error.context).toMatchObject({
        testKey: 'testValue',
        timestamp: expect.any(String),
        userAgent: expect.any(String),
        url: expect.any(String)
      });
    });

    it('should preserve original error stack', () => {
      const originalError = new Error('Original error');
      const error = createEnhancedError(
        'Enhanced error',
        'component',
        { originalError }
      );

      expect(error.stack).toBe(originalError.stack);
      expect(error.cause).toBe(originalError);
    });
  });

  describe('createWASMError', () => {
    it('should create a WASM error with operation context', () => {
      const error = createWASMError(
        'WASM processing failed',
        'process',
        {
          code: 'PROCESS_ERROR',
          retryable: true,
          context: { requestId: '123' }
        }
      );

      expect(error.name).toBe('WASMError');
      expect(error.message).toBe('WASM processing failed');
      expect(error.operation).toBe('process');
      expect(error.code).toBe('PROCESS_ERROR');
      expect(error.retryable).toBe(true);
      expect(error.context).toMatchObject({
        operation: 'process',
        requestId: '123',
        timestamp: expect.any(String)
      });
    });

    it('should default retryable to true for WASM errors', () => {
      const error = createWASMError('Test error', 'initialize');
      expect(error.retryable).toBe(true);
    });
  });

  describe('createNetworkError', () => {
    it('should create a network error with HTTP context', () => {
      const error = createNetworkError(
        'Network request failed',
        {
          status: 500,
          statusText: 'Internal Server Error',
          url: 'https://api.example.com',
          timeout: false
        }
      );

      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Network request failed');
      expect(error.status).toBe(500);
      expect(error.statusText).toBe('Internal Server Error');
      expect(error.url).toBe('https://api.example.com');
      expect(error.timeout).toBe(false);
    });
  });

  describe('createValidationError', () => {
    it('should create a validation error with field context', () => {
      const error = createValidationError(
        'Invalid email format',
        'email',
        'invalid-email',
        'valid email format'
      );

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid email format');
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
      expect(error.constraint).toBe('valid email format');
    });
  });

  describe('createTokenRefreshError', () => {
    it('should create a token refresh error with token context', () => {
      const error = createTokenRefreshError(
        'Token expired',
        {
          tokenType: 'Bearer',
          expiresAt: '2024-01-01T00:00:00Z',
          refreshable: true
        }
      );

      expect(error.name).toBe('TokenRefreshError');
      expect(error.message).toBe('Token expired');
      expect(error.tokenType).toBe('Bearer');
      expect(error.expiresAt).toBe('2024-01-01T00:00:00Z');
      expect(error.refreshable).toBe(true);
    });

    it('should default refreshable to true', () => {
      const error = createTokenRefreshError('Token error');
      expect(error.refreshable).toBe(true);
    });
  });

  describe('RetryManager', () => {
    let retryManager: RetryManager;

    beforeEach(() => {
      retryManager = new RetryManager(3, 100, 1000);
    });

    it('should retry failed operations up to max retries', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const result = await retryManager.retry('test-key', operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(retryManager.getAttemptCount('test-key')).toBe(0); // Reset on success
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(
        createValidationError('Invalid input', 'field')
      );
      const isRetryable = vi.fn().mockReturnValue(false);

      await expect(
        retryManager.retry('test-key', operation, isRetryable)
      ).rejects.toThrow('Invalid input');
      
      expect(operation).toHaveBeenCalledTimes(1);
      expect(isRetryable).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should stop retrying after max attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      const isRetryable = vi.fn().mockReturnValue(true);

      await expect(
        retryManager.retry('test-key', operation, isRetryable)
      ).rejects.toThrow('Persistent failure');
      
      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should track attempt counts correctly', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Failure'));
      const isRetryable = vi.fn().mockReturnValue(true);

      try {
        await retryManager.retry('test-key', operation, isRetryable);
      } catch {
        // Expected to fail
      }

      expect(retryManager.getAttemptCount('test-key')).toBe(0); // Reset after final failure
    });

    it('should reset attempt counts', () => {
      retryManager['attempts'].set('test-key', 2);
      retryManager.reset('test-key');
      expect(retryManager.getAttemptCount('test-key')).toBe(0);
    });

    it('should reset all attempt counts when no key provided', () => {
      retryManager['attempts'].set('key1', 1);
      retryManager['attempts'].set('key2', 2);
      retryManager.reset();
      expect(retryManager.getAttemptCount('key1')).toBe(0);
      expect(retryManager.getAttemptCount('key2')).toBe(0);
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable WASM errors', () => {
      const error = createWASMError('Timeout error', 'process', { retryable: true });
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify non-retryable WASM errors', () => {
      const error = createWASMError('Fatal error', 'process', { retryable: false });
      expect(isRetryableError(error)).toBe(false);
    });

    it('should identify retryable network errors', () => {
      const error = createNetworkError('Server error', { status: 500 });
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify non-retryable client errors', () => {
      const error = createNetworkError('Bad request', { status: 400 });
      expect(isRetryableError(error)).toBe(false);
    });

    it('should identify retryable timeout errors', () => {
      const error = createNetworkError('Request timeout', { status: 408 });
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify retryable rate limit errors', () => {
      const error = createNetworkError('Too many requests', { status: 429 });
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify non-retryable validation errors', () => {
      const error = createValidationError('Invalid input', 'field');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should identify retryable token refresh errors', () => {
      const error = createTokenRefreshError('Token expired', { refreshable: true });
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify timeout errors by message', () => {
      const error = new Error('Request timeout occurred');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify connection errors by message', () => {
      const error = new Error('Network connection failed');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should default to non-retryable for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(isRetryableError(error)).toBe(false);
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    it('should return enhanced error user message if available', () => {
      const error = createEnhancedError(
        'Technical error',
        'wasm-processing',
        { userMessage: 'User friendly message' }
      );
      expect(getUserFriendlyErrorMessage(error)).toBe('User friendly message');
    });

    it('should return WASM-specific messages', () => {
      const initError = createWASMError('Init failed', 'initialize');
      expect(getUserFriendlyErrorMessage(initError)).toBe(
        'Failed to initialize the application. Please refresh the page.'
      );

      const processError = createWASMError('Process failed', 'process');
      expect(getUserFriendlyErrorMessage(processError)).toBe(
        'Failed to process your credentials. Please check your input and try again.'
      );
    });

    it('should return network-specific messages', () => {
      const timeoutError = createNetworkError('Timeout', { timeout: true });
      expect(getUserFriendlyErrorMessage(timeoutError)).toBe(
        'Request timed out. Please check your connection and try again.'
      );

      const serverError = createNetworkError('Server error', { status: 500 });
      expect(getUserFriendlyErrorMessage(serverError)).toBe(
        'Server error occurred. Please try again later.'
      );

      const authError = createNetworkError('Unauthorized', { status: 401 });
      expect(getUserFriendlyErrorMessage(authError)).toBe(
        'Authentication failed. Please check your credentials.'
      );
    });

    it('should return validation-specific messages', () => {
      const fieldError = createValidationError('Invalid email', 'email');
      expect(getUserFriendlyErrorMessage(fieldError)).toBe(
        'Invalid email. Please check your input.'
      );

      const genericError = createValidationError('Invalid data');
      expect(getUserFriendlyErrorMessage(genericError)).toBe(
        'Invalid input detected. Please check your data and try again.'
      );
    });

    it('should return token refresh messages', () => {
      const tokenError = createTokenRefreshError('Token expired');
      expect(getUserFriendlyErrorMessage(tokenError)).toBe(
        'Your session has expired. Please re-enter your credentials.'
      );
    });

    it('should return generic message for unknown errors', () => {
      const error = new Error('Unknown error');
      expect(getUserFriendlyErrorMessage(error)).toBe(
        'An unexpected error occurred. Please try again or contact support if the problem persists.'
      );
    });
  });

  describe('logError', () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
    });

    it('should log errors in development mode', () => {
      // Mock development environment
      vi.stubEnv('DEV', true);

      const error = createWASMError('Test error', 'process');
      const context = { testKey: 'testValue' };

      logError(error, context);

      expect(consoleSpy).toHaveBeenCalledWith('🚨 WASMError');
    });

    it('should not log in production mode', () => {
      // Mock production environment
      vi.stubEnv('DEV', false);

      const error = new Error('Test error');
      logError(error);

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('withTimeout', () => {
    it('should resolve when promise completes before timeout', async () => {
      const promise = Promise.resolve('success');
      const result = await withTimeout(promise, 1000, 'test');
      expect(result).toBe('success');
    });

    it('should reject with timeout error when promise takes too long', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 2000));
      
      await expect(
        withTimeout(promise, 100, 'test')
      ).rejects.toThrow('Operation timed out after 100ms');
    });

    it('should create WASM error for timeout', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        await withTimeout(promise, 100, 'process');
      } catch (error: any) {
        expect(error.name).toBe('WASMError');
        expect(error.operation).toBe('process');
        expect(error.code).toBe('TIMEOUT');
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete error flow with retry', async () => {
      let attempts = 0;
      const operation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw createWASMError('Temporary failure', 'process', { retryable: true });
        }
        return Promise.resolve('success');
      });

      const result = await globalRetryManager.retry(
        'integration-test',
        operation,
        isRetryableError
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry validation errors', async () => {
      const operation = vi.fn().mockRejectedValue(
        createValidationError('Invalid input', 'field')
      );

      await expect(
        globalRetryManager.retry('validation-test', operation, isRetryableError)
      ).rejects.toThrow('Invalid input');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should provide user-friendly messages for all error types', () => {
      const errors = [
        createWASMError('WASM error', 'process'),
        createNetworkError('Network error', { status: 500 }),
        createValidationError('Validation error', 'field'),
        createTokenRefreshError('Token error'),
        new Error('Generic error')
      ];

      errors.forEach(error => {
        const message = getUserFriendlyErrorMessage(error);
        expect(message).toBeTruthy();
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      });
    });
  });
});