import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    
    // Test execution configuration
    globals: true,
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    
    // Performance and memory settings
    maxConcurrency: 5,
    minThreads: 1,
    maxThreads: 4,
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/results.json',
      html: './test-results/index.html'
    },
    
    // Test categorization
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  }
});

// Test suite configurations for different test types
export const testSuites = {
  unit: {
    include: [
      'src/**/*.test.{ts,tsx}',
      '!src/test/integration.*.test.ts',
      '!src/test/performance.test.ts',
      '!src/test/accessibility.*.test.tsx'
    ],
    testTimeout: 5000
  },
  
  integration: {
    include: [
      'src/test/integration.*.test.ts'
    ],
    testTimeout: 15000,
    maxConcurrency: 2
  },
  
  performance: {
    include: [
      'src/test/performance.test.ts'
    ],
    testTimeout: 30000,
    maxConcurrency: 1,
    reporter: ['verbose']
  },
  
  accessibility: {
    include: [
      'src/test/accessibility.*.test.tsx'
    ],
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.ts', './src/test/accessibility-setup.ts']
  },
  
  e2e: {
    // E2E tests are handled by Playwright, not Vitest
    // This is just for reference
    testDir: './tests/e2e',
    timeout: 30000
  }
};

// Performance benchmarking configuration
export const performanceConfig = {
  // Memory usage thresholds (in MB)
  memoryThresholds: {
    componentRender: 50,
    dataProcessing: 100,
    fullApplication: 200
  },
  
  // Timing thresholds (in milliseconds)
  timingThresholds: {
    componentRender: 100,
    userInteraction: 50,
    dataTransformation: 50,
    formSubmission: 500
  },
  
  // Test data sizes for performance testing
  testDataSizes: {
    small: 10,
    medium: 100,
    large: 1000,
    xlarge: 10000
  }
};

// Accessibility testing configuration
export const accessibilityConfig = {
  // axe-core configuration
  axeConfig: {
    rules: {
      // Enable all WCAG 2.1 AA rules
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true },
      'aria-labels': { enabled: true },
      'semantic-markup': { enabled: true }
    },
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
  },
  
  // Screen reader simulation settings
  screenReaderConfig: {
    announcements: true,
    liveRegions: true,
    focusManagement: true
  },
  
  // Keyboard navigation testing
  keyboardConfig: {
    tabOrder: true,
    arrowKeys: true,
    enterSpace: true,
    escape: true,
    homeEnd: true
  }
};

// Test data generators
export const testDataGenerators = {
  // Generate mock WASM responses
  generateMockWASMResponse: (size: 'small' | 'medium' | 'large' = 'medium') => {
    const sizes = {
      small: { updates: 5, configKeys: 10, caseFields: 5 },
      medium: { updates: 50, configKeys: 50, caseFields: 10 },
      large: { updates: 500, configKeys: 200, caseFields: 20 }
    };
    
    const config = sizes[size];
    
    return {
      baseURL: 'https://api.uscis.gov',
      authMode: 'OAuth2',
      tokenHint: 'Bearer token',
      config: Object.fromEntries(
        Array.from({ length: config.configKeys }, (_, i) => [`key_${i}`, `value_${i}`])
      ),
      caseDetails: {
        caseNumber: 'MSC2190000001',
        currentStatus: 'Case Was Approved',
        processingCenter: 'National Benefits Center',
        priorityDate: '2021-01-15',
        caseType: 'I-485',
        lastUpdated: new Date().toISOString(),
        ...Object.fromEntries(
          Array.from({ length: config.caseFields }, (_, i) => [`field_${i}`, `value_${i}`])
        )
      },
      realtimeUpdates: Array.from({ length: config.updates }, (_, i) => ({
        id: `update_${i}`,
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        message: `Update ${i}`,
        level: 'info'
      }))
    };
  },
  
  // Generate mock user credentials
  generateMockCredentials: (valid: boolean = true) => ({
    clientId: valid ? 'test-client-123' : 'invalid@client!',
    clientSecret: valid ? 'TestSecret123' : '',
    environment: 'development' as const
  }),
  
  // Generate mock error responses
  generateMockError: (type: 'validation' | 'network' | 'processing' = 'processing') => {
    const errors = {
      validation: {
        error: 'Validation failed',
        context: { field: 'clientId', message: 'Invalid format' }
      },
      network: {
        error: 'Network error',
        context: { code: 'NETWORK_TIMEOUT', retryable: true }
      },
      processing: {
        error: 'Processing failed',
        context: { step: 'authentication', details: 'Invalid credentials' }
      }
    };
    
    return errors[type];
  }
};

// Test utilities
export const testUtils = {
  // Wait for async operations with timeout
  waitForAsync: async (condition: () => boolean, timeout: number = 5000) => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (!condition()) {
      throw new Error(`Condition not met within ${timeout}ms`);
    }
  },
  
  // Measure performance of operations
  measurePerformance: async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    return { result, duration };
  },
  
  // Mock worker message simulation
  createWorkerMock: () => {
    const messageHandlers = new Map<string, (event: any) => void>();
    
    return {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn((event: string, handler: (event: any) => void) => {
        messageHandlers.set(event, handler);
      }),
      removeEventListener: vi.fn(),
      simulateMessage: (type: string, data: any = {}, requestId?: number) => {
        const handler = messageHandlers.get('message');
        if (handler) {
          handler({
            data: { type, result: data, error: data.error, requestId, context: data.context }
          });
        }
      }
    };
  }
};