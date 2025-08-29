import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { WASMResponse, Credentials, TokenCertificationResult, RealtimeUpdate, ProcessingResult } from '../types';
import { toast } from 'react-toastify';
import { 
  transformWASMOutput, 
  transformRealtimeUpdate, 
  sanitizeForLogging,
  deepClone,
  clearTransformCache,
  getCacheStats
} from '../utils/dataTransform';
import {
  createWASMError,
  createNetworkError,
  createValidationError,
  createTokenRefreshError,
  globalRetryManager,
  isRetryableError,
  getUserFriendlyErrorMessage,
  logError,
  withTimeout
} from '../utils/errorHandling';

declare global {
  interface Window {
    Go: new () => {
      importObject: WebAssembly.Imports;
      run: (instance: WebAssembly.Instance) => void;
    };
    goProcessCredentials: (credentials: string) => Promise<WASMResponse>;
  }
}

export function useWasm() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [realtimeUpdates, setRealtimeUpdates] = useState<RealtimeUpdate[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const pendingRequestsRef = useRef<Map<number, { resolve: (value: any) => void; reject: (error: any) => void }>>(new Map());

  useEffect(() => {
    const worker = new Worker('/wasm-worker.js');
    workerRef.current = worker;

    const handleMessage = (e: MessageEvent) => {
      const { type, result, error, requestId } = e.data;

      switch (type) {
        case 'initialized':
          setIsLoaded(true);
          setIsLoading(false);
          setError(null); // Clear any previous initialization errors
          toast.success('WASM module loaded successfully');
          break;

        case 'result': {
          const resolveRequest = pendingRequestsRef.current.get(requestId);
          if (resolveRequest) {
            pendingRequestsRef.current.delete(requestId);
            
            try {
              // Transform the raw WASM result to our enhanced ProcessingResult structure
              const transformedResult = transformWASMOutput(result);
              
              // Create the WASMResponse with transformed data
              const wasmResponse: WASMResponse = {
                success: true,
                result: transformedResult
              };
              
              resolveRequest.resolve(wasmResponse);
            } catch (transformError) {
              const wasmError = createWASMError(
                'Failed to transform WASM result',
                'process',
                {
                  code: 'TRANSFORM_ERROR',
                  retryable: false,
                  context: { 
                    originalError: transformError,
                    rawResult: sanitizeForLogging(result)
                  }
                }
              );
              
              logError(wasmError, { operation: 'result-transformation' });
              
              // Fallback to original result structure if transformation fails
              const fallbackResponse: WASMResponse = {
                success: true,
                result: {
                  baseURL: result?.baseURL || '',
                  authMode: result?.authMode || '',
                  tokenHint: result?.tokenHint || '',
                  config: result?.config || {}
                }
              };
              
              resolveRequest.resolve(fallbackResponse);
              toast.warning('Data transformation partially failed, using fallback structure');
            }
          }
          break;
        }

        case 'certify-result': {
          const resolveCertify = pendingRequestsRef.current.get(requestId);
          if (resolveCertify) {
            pendingRequestsRef.current.delete(requestId);
            
            try {
              // Validate and enhance the certification result
              const enhancedResult: TokenCertificationResult = {
                isValid: Boolean(result?.isValid),
                caseStatus: String(result?.caseStatus || 'Unknown'),
                lastUpdated: String(result?.lastUpdated || new Date().toISOString()),
                caseDetails: result?.caseDetails && typeof result.caseDetails === 'object' 
                  ? result.caseDetails 
                  : {},
                verificationId: String(result?.verificationId || Math.random().toString(36).substr(2, 9))
              };
              
              resolveCertify.resolve(enhancedResult);
            } catch (certifyError) {
              const wasmError = createWASMError(
                'Failed to process certification result',
                'certify',
                {
                  code: 'CERTIFY_TRANSFORM_ERROR',
                  retryable: false,
                  context: { 
                    originalError: certifyError,
                    rawResult: sanitizeForLogging(result)
                  }
                }
              );
              
              logError(wasmError, { operation: 'certification-transformation' });
              
              // Fallback certification result
              const fallbackResult: TokenCertificationResult = {
                isValid: false,
                caseStatus: 'Error',
                lastUpdated: new Date().toISOString(),
                caseDetails: {
                  error: 'Failed to process certification result'
                },
                verificationId: Math.random().toString(36).substr(2, 9)
              };
              
              resolveCertify.resolve(fallbackResult);
              toast.warning('Certification result processing partially failed');
            }
          }
          break;
        }

        case 'health-result': {
          const resolveHealth = pendingRequestsRef.current.get(requestId);
          if (resolveHealth) {
            pendingRequestsRef.current.delete(requestId);
            resolveHealth.resolve(result);
          }
          break;
        }

        case 'cache-hit':
          // Handle cache hits (for future enhancement)
          break;

        case 'cache-cleared': {
          const resolveCacheClear = pendingRequestsRef.current.get(requestId);
          if (resolveCacheClear) {
            pendingRequestsRef.current.delete(requestId);
            resolveCacheClear.resolve(undefined);
          }
          break;
        }

        case 'realtime-update': {
          // Transform and validate realtime updates from Go
          try {
            const transformedUpdate = transformRealtimeUpdate(result);
            if (transformedUpdate) {
              setRealtimeUpdates(prev => {
                // Prevent duplicate updates and limit history
                const filtered = prev.filter(update => update.id !== transformedUpdate.id);
                const updated = [...filtered, transformedUpdate];
                
                // Keep only the last 100 updates to prevent memory issues
                return updated.slice(-100);
              });
            } else {
              logError(
                createWASMError('Failed to transform realtime update', 'process', {
                  code: 'UPDATE_TRANSFORM_ERROR',
                  retryable: false,
                  context: { rawUpdate: sanitizeForLogging(result) }
                }),
                { operation: 'realtime-update-transformation' }
              );
            }
          } catch (updateError) {
            const wasmError = createWASMError(
              'Error processing realtime update',
              'process',
              {
                code: 'UPDATE_PROCESSING_ERROR',
                retryable: false,
                context: { 
                  originalError: updateError,
                  rawUpdate: sanitizeForLogging(result)
                }
              }
            );
            
            logError(wasmError, { operation: 'realtime-update-processing' });
          }
          break;
        }

        case 'error': {
          const rejectRequest = pendingRequestsRef.current.get(requestId);
          if (rejectRequest) {
            pendingRequestsRef.current.delete(requestId);
            
            // Create enhanced WASM error with context
            const wasmError = createWASMError(
              error || 'Unknown WASM error',
              'process', // Default operation, could be enhanced with more context
              {
                code: e.data.code || 'UNKNOWN_ERROR',
                retryable: true,
                context: e.data.context
              }
            );
            
            logError(wasmError, { requestId, operation: 'wasm-request' });
            rejectRequest.reject(wasmError);
          } else {
            // General error (not related to a specific request)
            const generalError = createWASMError(
              error || 'Unknown WASM error',
              'process',
              {
                code: e.data.code || 'GENERAL_ERROR',
                retryable: false,
                context: e.data.context
              }
            );
            
            setError(generalError);
            const userMessage = getUserFriendlyErrorMessage(generalError);
            toast.error(userMessage);
            logError(generalError, { operation: 'wasm-general' });
          }
          break;
        }
      }
    };

    const handleError = (error: ErrorEvent) => {
      const workerError = createWASMError(
        'Web Worker failed to load',
        'initialize',
        {
          code: 'WORKER_LOAD_ERROR',
          retryable: true,
          context: { 
            filename: error.filename,
            lineno: error.lineno,
            colno: error.colno,
            message: error.message
          }
        }
      );
      
      setError(workerError);
      setIsLoading(false);
      
      const userMessage = getUserFriendlyErrorMessage(workerError);
      toast.error(userMessage);
      logError(workerError, { operation: 'worker-initialization' });
    };

    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);

    // Initialize the worker
    worker.postMessage({ type: 'initialize' });

    return () => {
      worker.removeEventListener('message', handleMessage);
      worker.removeEventListener('error', handleError);
      worker.terminate();
      workerRef.current = null;
      // Fail all pending requests on teardown
      for (const [, { reject }] of pendingRequestsRef.current) {
        try { 
          reject(createWASMError(
            'WASM worker disposed',
            'process',
            { code: 'WORKER_DISPOSED', retryable: false }
          )); 
        } catch {}
      }
      pendingRequestsRef.current.clear();
    };
  }, []);

  const postWithTimeout = useCallback(<T>(
    type: string,
    data: any,
    timeoutMs: number = 30000
  ): Promise<T> => {
    if (!isLoaded || !workerRef.current) {
      throw createWASMError(
        'WASM module not loaded',
        'process',
        { code: 'MODULE_NOT_LOADED', retryable: true }
      );
    }

    const requestId = ++requestIdRef.current;

    const promise = new Promise<T>((resolve, reject) => {
      pendingRequestsRef.current.set(requestId, { resolve, reject });

      workerRef.current!.postMessage({
        type,
        data,
        requestId
      });

      // Set a timeout for the request
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(createWASMError(
            `Request timeout after ${timeoutMs}ms`,
            type as any,
            { 
              code: 'REQUEST_TIMEOUT', 
              retryable: true,
              context: { timeoutMs, requestId, type }
            }
          ));
        }
      }, timeoutMs);
    });

    return withTimeout(promise, timeoutMs, type);
  }, [isLoaded]);

  const processCredentials = useCallback(async (credentials: Credentials): Promise<WASMResponse> => {
    const operationKey = 'process-credentials';
    
    return globalRetryManager.retry(
      operationKey,
      async () => {
        try {
          // Validate credentials before processing
          if (!credentials || typeof credentials !== 'object') {
            throw createValidationError(
              'Invalid credentials: expected object',
              'credentials',
              credentials,
              'object'
            );
          }
          
          if (!credentials.clientId || typeof credentials.clientId !== 'string') {
            throw createValidationError(
              'Invalid credentials: clientId is required',
              'clientId',
              credentials.clientId,
              'non-empty string'
            );
          }
          
          if (!credentials.clientSecret || typeof credentials.clientSecret !== 'string') {
            throw createValidationError(
              'Invalid credentials: clientSecret is required',
              'clientSecret',
              credentials.clientSecret ? '[REDACTED]' : credentials.clientSecret,
              'non-empty string'
            );
          }
          
          if (!credentials.environment || typeof credentials.environment !== 'string') {
            throw createValidationError(
              'Invalid credentials: environment is required',
              'environment',
              credentials.environment,
              'valid environment'
            );
          }

          // Clear previous realtime updates when starting new processing
          setRealtimeUpdates([]);
          
          // Use longer timeout for credential processing (45 seconds)
          const result = await postWithTimeout<WASMResponse>('process', credentials, 45000);
          
          // Additional validation of the result
          if (!result) {
            throw createWASMError(
              'No result received from WASM processing',
              'process',
              { code: 'NO_RESULT', retryable: true }
            );
          }
          
          return result;
        } catch (error) {
          logError(error as Error, { 
            operation: 'processCredentials',
            environment: credentials?.environment,
            hasClientId: !!credentials?.clientId,
            hasClientSecret: !!credentials?.clientSecret
          });
          
          // For validation errors, return immediately without retry
          if (error instanceof Error && error.name === 'ValidationError') {
            const errorResponse: WASMResponse = {
              success: false,
              error: getUserFriendlyErrorMessage(error)
            };
            return errorResponse;
          }
          
          throw error;
        }
      },
      isRetryableError
    ).catch((error) => {
      // Final error handling after all retries exhausted
      const errorResponse: WASMResponse = {
        success: false,
        error: getUserFriendlyErrorMessage(error as Error)
      };
      
      return errorResponse;
    });
  }, [postWithTimeout]);

  const certifyToken = useCallback(async (tokenData: { token: string; caseNumber: string; environment: string }): Promise<TokenCertificationResult> => {
    const operationKey = 'certify-token';
    
    return globalRetryManager.retry(
      operationKey,
      async () => {
        try {
          // Validate token data before processing
          if (!tokenData || typeof tokenData !== 'object') {
            throw createValidationError(
              'Invalid token data: expected object',
              'tokenData',
              tokenData,
              'object'
            );
          }
          
          if (!tokenData.token || typeof tokenData.token !== 'string') {
            throw createValidationError(
              'Invalid token data: token is required',
              'token',
              '[REDACTED]',
              'non-empty string'
            );
          }
          
          if (!tokenData.caseNumber || typeof tokenData.caseNumber !== 'string') {
            throw createValidationError(
              'Invalid token data: caseNumber is required',
              'caseNumber',
              tokenData.caseNumber,
              'non-empty string'
            );
          }
          
          if (!tokenData.environment || typeof tokenData.environment !== 'string') {
            throw createValidationError(
              'Invalid token data: environment is required',
              'environment',
              tokenData.environment,
              'valid environment'
            );
          }

          // Use standard timeout for token certification (30 seconds)
          const result = await postWithTimeout<TokenCertificationResult>('certify-token', tokenData, 30000);
          
          if (!result) {
            throw createWASMError(
              'No result received from token certification',
              'certify',
              { code: 'NO_RESULT', retryable: true }
            );
          }
          
          return result;
        } catch (error) {
          logError(error as Error, { 
            operation: 'certifyToken',
            environment: tokenData?.environment,
            hasCaseNumber: !!tokenData?.caseNumber,
            hasToken: !!tokenData?.token
          });
          
          // For validation errors, don't retry
          if (error instanceof Error && error.name === 'ValidationError') {
            throw error;
          }
          
          throw error;
        }
      },
      (error) => {
        // Token refresh errors should be retryable
        if (error.name === 'TokenRefreshError') {
          return true;
        }
        return isRetryableError(error);
      }
    ).catch((error) => {
      // Final error handling after all retries exhausted
      const errorResult: TokenCertificationResult = {
        isValid: false,
        caseStatus: 'Error',
        lastUpdated: new Date().toISOString(),
        caseDetails: {
          error: getUserFriendlyErrorMessage(error as Error)
        },
        verificationId: Math.random().toString(36).substr(2, 9)
      };
      
      return errorResult;
    });
  }, [postWithTimeout]);

  const healthCheck = useCallback(async (): Promise<any> => {
    const operationKey = 'health-check';
    
    return globalRetryManager.retry(
      operationKey,
      async () => {
        try {
          if (!isLoaded || !workerRef.current) {
            throw createWASMError(
              'WASM module not loaded',
              'health',
              { code: 'MODULE_NOT_LOADED', retryable: true }
            );
          }

          const result = await postWithTimeout('health-check', {}, 10000);
          
          // Validate health check result
          if (!result) {
            throw createWASMError(
              'No response from health check',
              'health',
              { code: 'NO_RESPONSE', retryable: true }
            );
          }
          
          return result;
        } catch (error) {
          logError(error as Error, { operation: 'healthCheck' });
          throw error;
        }
      },
      isRetryableError
    ).catch((error) => {
      // Return structured health check failure
      return {
        status: 'error',
        message: getUserFriendlyErrorMessage(error as Error),
        timestamp: new Date().toISOString(),
        isHealthy: false,
        error: error instanceof Error ? error.name : 'UnknownError'
      };
    });
  }, [postWithTimeout, isLoaded]);

  const clearCache = useCallback(async (): Promise<void> => {
    const operationKey = 'clear-cache';
    
    return globalRetryManager.retry(
      operationKey,
      async () => {
        try {
          if (!isLoaded || !workerRef.current) {
            throw createWASMError(
              'WASM module not loaded',
              'process',
              { code: 'MODULE_NOT_LOADED', retryable: true }
            );
          }

          await postWithTimeout('clear-cache', {}, 5000);
          toast.success('Cache cleared successfully');
        } catch (error) {
          logError(error as Error, { operation: 'clearCache' });
          
          const userMessage = getUserFriendlyErrorMessage(error as Error);
          toast.error(`Failed to clear cache: ${userMessage}`);
          throw error;
        }
      },
      isRetryableError
    );
  }, [postWithTimeout, isLoaded]);

  const clearRealtimeUpdates = useCallback(() => {
    setRealtimeUpdates([]);
    // Also clear transform cache when clearing updates to free memory
    clearTransformCache();
  }, []);

  // Memoized processing statistics to prevent recalculation
  const processingStatistics = useMemo(() => {
    return {
      totalUpdates: realtimeUpdates.length,
      lastUpdate: realtimeUpdates.length > 0 ? realtimeUpdates[realtimeUpdates.length - 1] : null,
      updatesByLevel: realtimeUpdates.reduce((acc, update) => {
        acc[update.level] = (acc[update.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      pendingRequests: pendingRequestsRef.current.size,
      isHealthy: isLoaded && !error,
      retryStats: {
        processCredentials: globalRetryManager.getAttemptCount('process-credentials'),
        certifyToken: globalRetryManager.getAttemptCount('certify-token'),
        healthCheck: globalRetryManager.getAttemptCount('health-check'),
        clearCache: globalRetryManager.getAttemptCount('clear-cache')
      },
      cacheStats: getCacheStats()
    };
  }, [realtimeUpdates, isLoaded, error]);

  const getProcessingStatistics = useCallback(() => processingStatistics, [processingStatistics]);

  const retryLastOperation = useCallback(async (operation: 'process' | 'certify' | 'health', data?: any) => {
    try {
      // Reset retry count for the specific operation
      globalRetryManager.reset(`${operation}-${operation === 'process' ? 'credentials' : operation === 'certify' ? 'token' : 'check'}`);
      
      switch (operation) {
        case 'process':
          if (!data) {
            throw createValidationError(
              'Credentials required for retry',
              'data',
              data,
              'credentials object'
            );
          }
          return await processCredentials(data);
        case 'certify':
          if (!data) {
            throw createValidationError(
              'Token data required for retry',
              'data',
              data,
              'token data object'
            );
          }
          return await certifyToken(data);
        case 'health':
          return await healthCheck();
        default:
          throw createValidationError(
            `Unknown operation: ${operation}`,
            'operation',
            operation,
            'valid operation type'
          );
      }
    } catch (error) {
      logError(error as Error, { 
        operation: 'retryLastOperation',
        retryOperation: operation,
        hasData: !!data
      });
      
      const userMessage = getUserFriendlyErrorMessage(error as Error);
      toast.error(`Retry failed: ${userMessage}`);
      throw error;
    }
  }, [processCredentials, certifyToken, healthCheck]);

  return {
    // Core state
    isLoaded,
    isLoading,
    error,
    
    // Main operations
    processCredentials,
    certifyToken,
    healthCheck,
    clearCache,
    
    // Realtime updates
    realtimeUpdates,
    clearRealtimeUpdates,
    
    // Enhanced utilities
    getProcessingStatistics,
    retryLastOperation
  };
}
