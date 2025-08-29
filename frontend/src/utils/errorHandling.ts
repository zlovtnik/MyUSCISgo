import type { EnhancedError, ErrorCategory } from '../components/error/ErrorBoundary';

// WASM-specific error types
export interface WASMError extends Error {
  code?: string;
  operation?: 'process' | 'certify' | 'health' | 'initialize';
  retryable?: boolean;
  context?: Record<string, any>;
}

// Network error types
export interface NetworkError extends Error {
  status?: number;
  statusText?: string;
  url?: string;
  timeout?: boolean;
}

// Validation error types
export interface ValidationError extends Error {
  field?: string;
  value?: any;
  constraint?: string;
}

// Token refresh error types
export interface TokenRefreshError extends Error {
  tokenType?: string;
  expiresAt?: string;
  refreshable?: boolean;
}

/**
 * Creates an enhanced error with additional context and categorization
 */
export function createEnhancedError(
  message: string,
  category: ErrorCategory,
  options: {
    originalError?: Error;
    retryable?: boolean;
    userMessage?: string;
    context?: Record<string, any>;
  } = {}
): EnhancedError {
  const error = new Error(message) as EnhancedError;
  
  error.category = category;
  error.retryable = options.retryable ?? false;
  error.userMessage = options.userMessage;
  error.technicalDetails = message;
  error.context = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    ...options.context
  };

  // Preserve original error stack if available
  if (options.originalError) {
    error.stack = options.originalError.stack;
    error.cause = options.originalError;
  }

  return error;
}

/**
 * Creates a WASM-specific error with operation context
 */
export function createWASMError(
  message: string,
  operation: WASMError['operation'],
  options: {
    code?: string;
    retryable?: boolean;
    context?: Record<string, any>;
  } = {}
): WASMError {
  const error = new Error(message) as WASMError;
  
  error.name = 'WASMError';
  error.operation = operation;
  error.code = options.code;
  error.retryable = options.retryable ?? true; // WASM errors are generally retryable
  error.context = {
    operation,
    timestamp: new Date().toISOString(),
    ...options.context
  };

  return error;
}

/**
 * Creates a network error with HTTP context
 */
export function createNetworkError(
  message: string,
  options: {
    status?: number;
    statusText?: string;
    url?: string;
    timeout?: boolean;
  } = {}
): NetworkError {
  const error = new Error(message) as NetworkError;
  
  error.name = 'NetworkError';
  error.status = options.status;
  error.statusText = options.statusText;
  error.url = options.url;
  error.timeout = options.timeout;

  return error;
}

/**
 * Creates a validation error with field context
 */
export function createValidationError(
  message: string,
  field?: string,
  value?: any,
  constraint?: string
): ValidationError {
  const error = new Error(message) as ValidationError;
  
  error.name = 'ValidationError';
  error.field = field;
  error.value = value;
  error.constraint = constraint;

  return error;
}

/**
 * Creates a token refresh error with token context
 */
export function createTokenRefreshError(
  message: string,
  options: {
    tokenType?: string;
    expiresAt?: string;
    refreshable?: boolean;
  } = {}
): TokenRefreshError {
  const error = new Error(message) as TokenRefreshError;
  
  error.name = 'TokenRefreshError';
  error.tokenType = options.tokenType;
  error.expiresAt = options.expiresAt;
  error.refreshable = options.refreshable ?? true;

  return error;
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryManager {
  private attempts = new Map<string, number>();
  private lastAttempt = new Map<string, number>();

  constructor(
    private maxRetries: number = 3,
    private baseDelay: number = 1000,
    private maxDelay: number = 10000
  ) {}

  async retry<T>(
    key: string,
    operation: () => Promise<T>,
    isRetryable: (error: Error) => boolean = () => true
  ): Promise<T> {
    const attempts = this.attempts.get(key) || 0;
    
    try {
      const result = await operation();
      // Reset on success
      this.attempts.delete(key);
      this.lastAttempt.delete(key);
      return result;
    } catch (error) {
      const currentTime = Date.now();
      const lastTime = this.lastAttempt.get(key) || 0;
      
      // Check if we should retry
      if (attempts >= this.maxRetries || !isRetryable(error as Error)) {
        this.attempts.delete(key);
        this.lastAttempt.delete(key);
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.baseDelay * Math.pow(2, attempts),
        this.maxDelay
      );

      // Ensure minimum time between attempts
      const timeSinceLastAttempt = currentTime - lastTime;
      const actualDelay = Math.max(delay - timeSinceLastAttempt, 0);

      // Update attempt tracking
      this.attempts.set(key, attempts + 1);
      this.lastAttempt.set(key, currentTime + actualDelay);

      // Wait before retry
      if (actualDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, actualDelay));
      }

      // Recursive retry
      return this.retry(key, operation, isRetryable);
    }
  }

  getAttemptCount(key: string): number {
    return this.attempts.get(key) || 0;
  }

  reset(key?: string) {
    if (key) {
      this.attempts.delete(key);
      this.lastAttempt.delete(key);
    } else {
      this.attempts.clear();
      this.lastAttempt.clear();
    }
  }
}

/**
 * Global retry manager instance
 */
export const globalRetryManager = new RetryManager();

/**
 * Determines if an error is retryable based on its type and properties
 */
export function isRetryableError(error: Error): boolean {
  // WASM errors are generally retryable
  if (error.name === 'WASMError') {
    const wasmError = error as WASMError;
    return wasmError.retryable !== false;
  }

  // Network errors are retryable except for client errors
  if (error.name === 'NetworkError') {
    const networkError = error as NetworkError;
    if (networkError.status) {
      // 4xx client errors are not retryable (except 408, 429)
      if (networkError.status >= 400 && networkError.status < 500) {
        return networkError.status === 408 || networkError.status === 429;
      }
      // 5xx server errors are retryable
      return networkError.status >= 500;
    }
    // Network timeouts are retryable
    return networkError.timeout === true;
  }

  // Token refresh errors are retryable if refreshable
  if (error.name === 'TokenRefreshError') {
    const tokenError = error as TokenRefreshError;
    return tokenError.refreshable !== false;
  }

  // Validation errors are not retryable
  if (error.name === 'ValidationError') {
    return false;
  }

  // Enhanced errors use their retryable property
  if ('retryable' in error) {
    return (error as EnhancedError).retryable === true;
  }

  // Timeout errors are retryable
  if (error.message.toLowerCase().includes('timeout')) {
    return true;
  }

  // Connection errors are retryable
  if (error.message.toLowerCase().includes('connection') || 
      error.message.toLowerCase().includes('network')) {
    return true;
  }

  // Default to not retryable for unknown errors
  return false;
}

/**
 * Gets user-friendly error messages for different error types
 */
export function getUserFriendlyErrorMessage(error: Error): string {
  // Use enhanced error user message if available
  if ('userMessage' in error && (error as EnhancedError).userMessage) {
    return (error as EnhancedError).userMessage!;
  }

  // WASM-specific messages
  if (error.name === 'WASMError') {
    const wasmError = error as WASMError;
    switch (wasmError.operation) {
      case 'initialize':
        return 'Failed to initialize the application. Please refresh the page.';
      case 'process':
        return 'Failed to process your credentials. Please check your input and try again.';
      case 'certify':
        return 'Failed to verify your token. Please try again.';
      case 'health':
        return 'System health check failed. Please try again later.';
      default:
        return 'A processing error occurred. Please try again.';
    }
  }

  // Network-specific messages
  if (error.name === 'NetworkError') {
    const networkError = error as NetworkError;
    if (networkError.timeout) {
      return 'Request timed out. Please check your connection and try again.';
    }
    if (networkError.status) {
      if (networkError.status >= 500) {
        return 'Server error occurred. Please try again later.';
      }
      if (networkError.status === 401 || networkError.status === 403) {
        return 'Authentication failed. Please check your credentials.';
      }
      if (networkError.status === 404) {
        return 'Service not found. Please contact support.';
      }
    }
    return 'Network error occurred. Please check your connection.';
  }

  // Validation-specific messages
  if (error.name === 'ValidationError') {
    const validationError = error as ValidationError;
    if (validationError.field) {
      return `Invalid ${validationError.field}. Please check your input.`;
    }
    return 'Invalid input detected. Please check your data and try again.';
  }

  // Token refresh messages
  if (error.name === 'TokenRefreshError') {
    return 'Your session has expired. Please re-enter your credentials.';
  }

  // Generic fallback
  return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
}

/**
 * Logs errors with appropriate level and context
 */
export function logError(error: Error, context?: Record<string, any>) {
  const errorContext = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    ...context
  };

  if (import.meta.env.DEV) {
    console.group(`🚨 ${error.name || 'Error'}`);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('Context:', errorContext);
    
    if ('category' in error) {
      console.error('Category:', (error as EnhancedError).category);
    }
    if ('retryable' in error) {
      console.error('Retryable:', (error as EnhancedError).retryable);
    }
    
    console.groupEnd();
  }

  // In production, this would send to an error monitoring service
  // reportErrorToService(error, errorContext);
}

/**
 * Creates a timeout promise that rejects after the specified time
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(createWASMError(
          `Operation timed out after ${timeoutMs}ms`,
          operation as WASMError['operation'],
          { code: 'TIMEOUT', retryable: true }
        ));
      }, timeoutMs);
    })
  ]);
}