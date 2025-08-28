// Web Worker for WASM execution
// This worker handles the WASM module loading and execution to offload from main thread

let wasmInstance = null;
let wasmCertifyInstance = null;
let isInitialized = false;
let cache = new Map(); // Simple cache for results

// Cache configuration
const CACHE_SIZE_LIMIT = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Cache entry structure
function createCacheEntry(result) {
  return {
    result: result,
    timestamp: Date.now()
  };
}

// Check if cache entry is expired
function isExpired(entry) {
  return Date.now() - entry.timestamp > CACHE_TTL;
}

// Clean expired cache entries
function cleanCache() {
  for (const [key, entry] of cache.entries()) {
    if (isExpired(entry)) {
      cache.delete(key);
    }
  }
}

// Generate cache key from credentials
function generateCacheKey(credentials) {
  // Strip secrets; only hash non-sensitive fields
  const { clientSecret, token, ...safe } = credentials || {};
  const str = JSON.stringify(safe);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // force 32-bit
  }
  return hash.toString();
}

// Check if we should cache based on credentials
function shouldCache(credentials) {
  if (!credentials) return false;
  if ('clientSecret' in credentials || 'token' in credentials) return false;
  return credentials.environment !== 'production';
}

// Get cached result if available
function getCachedResult(credentials) {
  if (!shouldCache(credentials)) return null;
  const key = generateCacheKey(credentials);
  const entry = cache.get(key);

  if (entry && !isExpired(entry)) {
    return entry.result;
  }

  if (entry) {
    cache.delete(key); // Remove expired entry
  }

  return null;
}

// Cache result
function cacheResult(credentials, result) {
  if (!shouldCache(credentials)) return;
  cleanCache(); // Clean expired entries

  if (cache.size >= CACHE_SIZE_LIMIT) {
    // Remove oldest entry (simple FIFO)
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }

  const key = generateCacheKey(credentials);
  cache.set(key, createCacheEntry(result));
}

// Initialize WASM module
async function initializeWASM() {
  try {
    if (isInitialized) return;

    // Load wasm_exec.js if not already loaded
    if (!self.Go) {
      importScripts('/wasm_exec.js');
    }

    const go = new self.Go();
    let wasm;
    try {
      wasm = await WebAssembly.instantiateStreaming(fetch('/main.wasm'), go.importObject);
    } catch (e) {
      const resp = await fetch('/main.wasm');
      const buf = await resp.arrayBuffer();
      wasm = await WebAssembly.instantiate(buf, go.importObject);
    }
    go.run(wasm.instance);

    wasmInstance = self.goProcessCredentials;
    wasmCertifyInstance = self.goCertifyToken;
    isInitialized = true;

    self.postMessage({ type: 'initialized' });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: `Failed to initialize WASM: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

// Process credentials
async function processCredentials(credentials) {
  if (!isInitialized || !wasmInstance) {
    throw new Error('WASM not initialized');
  }

  try {
    // Check cache first
    const cachedResult = getCachedResult(credentials);
    if (cachedResult) {
      return cachedResult;
    }

    const responseString = await wasmInstance(JSON.stringify(credentials));
    
    // Parse the JSON response from WASM
    let response;
    try {
      response = JSON.parse(responseString);
    } catch (parseError) {
      throw new Error(`Failed to parse WASM response: ${responseString} (parse error: ${parseError.message})`);
    }

    // Cache successful results
    if (response && response.success) {
      cacheResult(credentials, response);
    }

    return response;
  } catch (error) {
    throw new Error(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Process token certification
async function certifyToken(tokenData) {
  if (!isInitialized || !wasmCertifyInstance) {
    throw new Error('WASM not initialized');
  }

  try {
    const response = await wasmCertifyInstance(JSON.stringify(tokenData));
    
    // Parse the JSON response from WASM
    let result;
    try {
      result = JSON.parse(response);
    } catch (parseError) {
      throw new Error(`Failed to parse WASM certification response: ${response} (parse error: ${parseError.message})`);
    }

    return result;
  } catch (error) {
    throw new Error(`Token certification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Handle messages from main thread
self.onmessage = async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case 'initialize':
      await initializeWASM();
      // Set up realtime update callback
      self.goSetRealtimeCallback = (updateData) => {
        self.postMessage({
          type: 'realtime-update',
          result: JSON.parse(updateData),
          requestId: null
        });
      };
      break;

    case 'process':
      try {
        const result = await processCredentials(data);
        self.postMessage({
          type: 'result',
          result,
          requestId: e.data.requestId
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: e.data.requestId
        });
      }
      break;

    case 'health-check':
      try {
        const health = self.goHealthCheck();
        self.postMessage({
          type: 'health-result',
          result: health,
          requestId: e.data.requestId
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: e.data.requestId
        });
      }
      break;

    case 'certify-token':
      try {
        const result = await certifyToken(data);
        self.postMessage({
          type: 'certify-result',
          result,
          requestId: e.data.requestId
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          requestId: e.data.requestId
        });
      }
      break;

    case 'clear-cache':
      cache.clear();
      self.postMessage({
        type: 'cache-cleared',
        requestId: e.data.requestId
      });
      break;
  }
};
