import { useState, useEffect, useCallback, useRef } from 'react';
import type { WASMResponse, Credentials } from '../types';
import { toast } from 'react-toastify';

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
  const [error, setError] = useState<string | null>(null);
  const [realtimeUpdates, setRealtimeUpdates] = useState<any[]>([]);
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
          toast.success('WASM module loaded successfully');
          break;

        case 'result': {
          const resolveRequest = pendingRequestsRef.current.get(requestId);
          if (resolveRequest) {
            pendingRequestsRef.current.delete(requestId);
            resolveRequest.resolve(result);
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
          // Handle realtime updates from Go
          setRealtimeUpdates(prev => [...prev, result]);
          break;
        }

        case 'error': {
          const rejectRequest = pendingRequestsRef.current.get(requestId);
          if (rejectRequest) {
            pendingRequestsRef.current.delete(requestId);
            rejectRequest.reject(new Error(error));
          } else {
            // General error (not related to a specific request)
            setError(error);
            toast.error(`WASM Error: ${error}`);
            console.error('WASM worker error:', error);
          }
          break;
        }
      }
    };

    const handleError = (error: ErrorEvent) => {
      setError('Web Worker failed to load');
      toast.error('Web Worker failed to load');
      console.error('Web Worker error:', error);
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
      pendingRequestsRef.current.clear();
    };
  }, []);

  const processCredentials = useCallback(async (credentials: Credentials): Promise<WASMResponse> => {
    if (!isLoaded || !workerRef.current) {
      throw new Error('WASM module not loaded');
    }

    const requestId = ++requestIdRef.current;

    return new Promise((resolve, reject) => {
      pendingRequestsRef.current.set(requestId, { resolve, reject });

      workerRef.current!.postMessage({
        type: 'process',
        data: credentials,
        requestId
      });

      // Set a timeout for the request
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 30000); // 30 second timeout
    });
  }, [isLoaded]);

  const healthCheck = useCallback(async (): Promise<any> => {
    if (!isLoaded || !workerRef.current) {
      throw new Error('WASM module not loaded');
    }

    const requestId = ++requestIdRef.current;

    return new Promise((resolve, reject) => {
      pendingRequestsRef.current.set(requestId, { resolve, reject });

      workerRef.current!.postMessage({
        type: 'health-check',
        requestId
      });

      // Set a timeout for the request
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Health check timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }, [isLoaded]);

  const clearCache = useCallback(async (): Promise<void> => {
    if (!isLoaded || !workerRef.current) {
      throw new Error('WASM module not loaded');
    }

    const requestId = ++requestIdRef.current;

    return new Promise((resolve, reject) => {
      pendingRequestsRef.current.set(requestId, { resolve, reject });

      workerRef.current!.postMessage({
        type: 'clear-cache',
        requestId
      });

      // Set a timeout for the request
      setTimeout(() => {
        if (pendingRequestsRef.current.has(requestId)) {
          pendingRequestsRef.current.delete(requestId);
          reject(new Error('Cache clear timeout'));
        }
      }, 5000); // 5 second timeout
    });
  }, [isLoaded]);

  const clearRealtimeUpdates = useCallback(() => {
    setRealtimeUpdates([]);
  }, []);

  return {
    isLoaded,
    isLoading,
    error,
    processCredentials,
    healthCheck,
    clearCache,
    realtimeUpdates,
    clearRealtimeUpdates
  };
}
