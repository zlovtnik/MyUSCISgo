import { describe, it, expect, vi } from 'vitest';
import {
  transformWASMOutput,
  transformOAuthToken,
  transformCaseDetails,
  transformProcessingMetadata,
  transformRealtimeUpdate,
  normalizeProcessingStep,
  normalizeLogLevel,
  safeJsonParse,
  deepClone,
  sanitizeForLogging
} from '../utils/dataTransform';
import type { 
  ProcessingResult, 
  OAuthToken, 
  CaseDetails, 
  ProcessingMetadata,
  RealtimeUpdate,
  ProcessingStep
} from '../types';

describe('Data Transform Utilities', () => {
  describe('transformWASMOutput', () => {
    it('should transform valid WASM output', () => {
      const rawOutput = {
        baseURL: 'https://api.example.com',
        authMode: 'oauth',
        tokenHint: 'test-hint',
        config: { key: 'value' },
        oauthToken: {
          accessToken: 'test-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: '2024-01-15T13:00:00Z'
        }
      };

      const result = transformWASMOutput(rawOutput);
      
      expect(result.baseURL).toBe('https://api.example.com');
      expect(result.authMode).toBe('oauth');
      expect(result.tokenHint).toBe('test-hint');
      expect(result.config).toEqual({ key: 'value' });
      expect(result.oauthToken).toBeDefined();
      expect(result.oauthToken?.accessToken).toBe('test-token');
    });

    it('should handle missing optional fields', () => {
      const rawOutput = {
        baseURL: 'https://api.example.com',
        authMode: 'oauth',
        tokenHint: 'test-hint',
        config: {}
      };

      const result = transformWASMOutput(rawOutput);
      
      expect(result.oauthToken).toBeUndefined();
      expect(result.caseDetails).toBeUndefined();
      expect(result.processingMetadata).toBeUndefined();
    });

    it('should handle snake_case field names', () => {
      const rawOutput = {
        baseURL: 'https://api.example.com',
        authMode: 'oauth',
        tokenHint: 'test-hint',
        config: {},
        oauth_token: {
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
          expires_at: '2024-01-15T13:00:00Z'
        }
      };

      const result = transformWASMOutput(rawOutput);
      expect(result.oauthToken?.accessToken).toBe('test-token');
    });

    it('should throw error for invalid input', () => {
      expect(() => transformWASMOutput(null)).toThrow('Invalid WASM output');
      expect(() => transformWASMOutput('string')).toThrow('Invalid WASM output');
    });
  });

  describe('transformOAuthToken', () => {
    it('should transform valid OAuth token', () => {
      const rawToken = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2024-01-15T13:00:00Z',
        scope: 'read write'
      };

      const result = transformOAuthToken(rawToken);
      
      expect(result).toBeDefined();
      expect(result?.accessToken).toBe('test-token');
      expect(result?.tokenType).toBe('Bearer');
      expect(result?.expiresIn).toBe(3600);
      expect(result?.scope).toBe('read write');
    });

    it('should handle snake_case field names', () => {
      const rawToken = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
        expires_at: '2024-01-15T13:00:00Z'
      };

      const result = transformOAuthToken(rawToken);
      expect(result?.accessToken).toBe('test-token');
      expect(result?.tokenType).toBe('Bearer');
    });

    it('should return null for invalid input', () => {
      expect(transformOAuthToken(null)).toBeNull();
      expect(transformOAuthToken('string')).toBeNull();
      expect(transformOAuthToken({})).toBeNull();
    });
  });

  describe('transformCaseDetails', () => {
    it('should transform valid case details', () => {
      const rawCase = {
        caseNumber: 'ABC1234567890',
        currentStatus: 'Approved',
        processingCenter: 'National Benefits Center',
        priorityDate: '2023-01-15',
        caseType: 'I-485',
        approvalDate: '2024-01-15',
        lastUpdated: '2024-01-15T12:00:00Z',
        verificationId: 'VER123'
      };

      const result = transformCaseDetails(rawCase);
      
      expect(result).toBeDefined();
      expect(result?.caseNumber).toBe('ABC1234567890');
      expect(result?.currentStatus).toBe('Approved');
      expect(result?.processingCenter).toBe('National Benefits Center');
    });

    it('should handle different field name formats', () => {
      const rawCase = {
        'Case Number': 'ABC1234567890',
        'Current Status': 'Approved',
        'Processing Center': 'NBC',
        'Priority Date': '2023-01-15',
        'Case Type': 'I-485',
        'Last Updated': '2024-01-15T12:00:00Z'
      };

      const result = transformCaseDetails(rawCase);
      expect(result?.caseNumber).toBe('ABC1234567890');
      expect(result?.currentStatus).toBe('Approved');
    });

    it('should return null for invalid input', () => {
      expect(transformCaseDetails(null)).toBeNull();
      expect(transformCaseDetails('string')).toBeNull();
    });
  });

  describe('transformProcessingMetadata', () => {
    it('should transform valid metadata', () => {
      const rawMetadata = {
        environment: 'development',
        processingTime: 1500,
        requestId: 'req-123',
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = transformProcessingMetadata(rawMetadata);
      
      expect(result).toBeDefined();
      expect(result?.environment).toBe('development');
      expect(result?.processingTime).toBe(1500);
      expect(result?.requestId).toBe('req-123');
    });

    it('should handle snake_case field names', () => {
      const rawMetadata = {
        environment: 'development',
        processing_time: 1500,
        request_id: 'req-123',
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = transformProcessingMetadata(rawMetadata);
      expect(result?.processingTime).toBe(1500);
      expect(result?.requestId).toBe('req-123');
    });

    it('should return null for invalid input', () => {
      expect(transformProcessingMetadata(null)).toBeNull();
      expect(transformProcessingMetadata('string')).toBeNull();
    });
  });

  describe('transformRealtimeUpdate', () => {
    it('should transform valid realtime update', () => {
      const rawUpdate = {
        id: 'update-123',
        timestamp: '2024-01-15T12:00:00Z',
        step: 'validating',
        message: 'Validating credentials',
        level: 'info'
      };

      const result = transformRealtimeUpdate(rawUpdate);
      
      expect(result).toBeDefined();
      expect(result?.id).toBe('update-123');
      expect(result?.step).toBe('validating');
      expect(result?.message).toBe('Validating credentials');
      expect(result?.level).toBe('info');
    });

    it('should normalize step and level', () => {
      const rawUpdate = {
        timestamp: '2024-01-15T12:00:00Z',
        step: 'authenticate',
        message: 'Test message',
        level: 'warn'
      };

      const result = transformRealtimeUpdate(rawUpdate);
      expect(result?.step).toBe('authenticating');
      expect(result?.level).toBe('warning');
    });

    it('should return null for invalid input', () => {
      expect(transformRealtimeUpdate(null)).toBeNull();
      expect(transformRealtimeUpdate('string')).toBeNull();
    });
  });

  describe('normalizeProcessingStep', () => {
    it('should normalize various step formats', () => {
      expect(normalizeProcessingStep('validating')).toBe('validating');
      expect(normalizeProcessingStep('authenticate')).toBe('authenticating');
      expect(normalizeProcessingStep('fetch-case-data')).toBe('fetching-case-data');
      expect(normalizeProcessingStep('processing')).toBe('processing-results');
      expect(normalizeProcessingStep('complete')).toBe('complete');
    });

    it('should handle unknown steps', () => {
      expect(normalizeProcessingStep('unknown-step')).toBe('validating');
      expect(normalizeProcessingStep('')).toBe('validating');
    });
  });

  describe('normalizeLogLevel', () => {
    it('should normalize various level formats', () => {
      expect(normalizeLogLevel('info')).toBe('info');
      expect(normalizeLogLevel('warn')).toBe('warning');
      expect(normalizeLogLevel('error')).toBe('error');
      expect(normalizeLogLevel('success')).toBe('success');
    });

    it('should handle unknown levels', () => {
      expect(normalizeLogLevel('unknown')).toBe('info');
      expect(normalizeLogLevel('')).toBe('info');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const json = '{"name": "test", "value": 123}';
      const result = safeJsonParse(json);
      
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('should return null for invalid JSON', () => {
      expect(safeJsonParse('invalid json')).toBeNull();
      expect(safeJsonParse('')).toBeNull();
      expect(safeJsonParse('{')).toBeNull();
    });
  });

  describe('deepClone', () => {
    it('should clone simple objects', () => {
      const obj = { name: 'test', value: 123 };
      const cloned = deepClone(obj);
      
      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('should clone nested objects', () => {
      const obj = {
        name: 'test',
        nested: {
          value: 123,
          array: [1, 2, 3]
        }
      };
      
      const cloned = deepClone(obj);
      
      expect(cloned).toEqual(obj);
      expect(cloned.nested).not.toBe(obj.nested);
      expect(cloned.nested.array).not.toBe(obj.nested.array);
    });

    it('should clone dates', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const cloned = deepClone(date);
      
      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });

    it('should handle primitive values', () => {
      expect(deepClone('string')).toBe('string');
      expect(deepClone(123)).toBe(123);
      expect(deepClone(null)).toBe(null);
      expect(deepClone(undefined)).toBe(undefined);
    });
  });

  describe('sanitizeForLogging', () => {
    it('should mask sensitive fields', () => {
      const obj = {
        name: 'test',
        token: 'secret-token-value',
        password: 'secret-password',
        publicData: 'visible'
      };
      
      const sanitized = sanitizeForLogging(obj);
      
      expect(sanitized.name).toBe('test');
      expect(sanitized.publicData).toBe('visible');
      expect(sanitized.token).toContain('****');
      expect(sanitized.password).toContain('****');
    });

    it('should handle nested objects', () => {
      const obj = {
        user: {
          name: 'test',
          credentials: {
            token: 'secret-token',
            apiKey: 'secret-key'
          }
        }
      };
      
      const sanitized = sanitizeForLogging(obj);
      
      expect(sanitized.user.name).toBe('test');
      expect(sanitized.user.credentials.token).toContain('****');
      expect(sanitized.user.credentials.apiKey).toContain('****');
    });

    it('should handle non-objects', () => {
      expect(sanitizeForLogging('string')).toBe('string');
      expect(sanitizeForLogging(123)).toBe(123);
      expect(sanitizeForLogging(null)).toBe(null);
    });
  });
});