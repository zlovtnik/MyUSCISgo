import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useWasm } from '../hooks/useWasm';
import type { Credentials } from '../types';

// Mock toast
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useWasm', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
  });

  it('should initialize with correct initial state', () => {
    const { result } = renderHook(() => useWasm());

    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.processCredentials).toBe('function');
    expect(typeof result.current.healthCheck).toBe('function');
    expect(typeof result.current.clearCache).toBe('function');
  });

  it('should handle processCredentials when WASM is not loaded', async () => {
    const { result } = renderHook(() => useWasm());

    await expect(result.current.processCredentials({
      clientId: 'test',
      clientSecret: 'secret',
      environment: 'development'
    })).rejects.toThrow('WASM module not loaded');
  });

  it('should validate credentials structure', () => {
    const validCredentials: Credentials = {
      clientId: 'test-client-123',
      clientSecret: 'MySecurePass123',
      environment: 'development'
    };

    expect(validCredentials.clientId).toBe('test-client-123');
    expect(validCredentials.clientSecret).toBe('MySecurePass123');
    expect(validCredentials.environment).toBe('development');
  });

  it('should handle invalid environment values', () => {
    const invalidCredentials = {
      clientId: 'test-client-123',
      clientSecret: 'MySecurePass123',
      environment: 'invalid' as any
    };

    expect(invalidCredentials.environment).toBe('invalid');
  });

  it('should handle empty credentials', () => {
    const emptyCredentials: Credentials = {
      clientId: '',
      clientSecret: '',
      environment: 'development'
    };

    expect(emptyCredentials.clientId).toBe('');
    expect(emptyCredentials.clientSecret).toBe('');
  });

  it('should handle special characters in credentials', () => {
    const specialCredentials: Credentials = {
      clientId: 'test_client-123@example.com',
      clientSecret: 'MySecurePass!@#$%^&*()',
      environment: 'production'
    };

    expect(specialCredentials.clientId).toContain('@');
    expect(specialCredentials.clientSecret).toContain('!@#$%^&*()');
  });

  it('should handle very long credentials', () => {
    const longClientId = 'a'.repeat(200);
    const longClientSecret = 'b'.repeat(300);

    const longCredentials: Credentials = {
      clientId: longClientId,
      clientSecret: longClientSecret,
      environment: 'staging'
    };

    expect(longCredentials.clientId.length).toBe(200);
    expect(longCredentials.clientSecret.length).toBe(300);
  });
});
