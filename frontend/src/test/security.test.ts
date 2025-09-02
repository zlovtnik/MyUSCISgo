import { describe, it, expect } from 'vitest';
import {
  maskSensitiveString,
  maskOAuthToken,
  maskCaseDetails,
  maskProcessingResult,
  maskConfigObject,
  sanitizeForLogging,
  validateMaskedData,
  generateSecureId,
  simpleHash,
  containsSensitiveData,
  secureCompare,
  sanitizeErrorMessage,
  getSecuritySettings
} from '../utils/security';
import type { OAuthToken, CaseDetails, ProcessingResult } from '../types';

describe('Security Utilities', () => {
  describe('maskSensitiveString', () => {
    it('should mask long strings correctly', () => {
      const result = maskSensitiveString('1234567890abcdef', 4, 4);
      expect(result).toBe('1234********cdef');
    });

    it('should handle short strings', () => {
      const result = maskSensitiveString('abc', 4, 4);
      expect(result).toBe('a**');
    });

    it('should handle custom mask character', () => {
      const result = maskSensitiveString('1234567890', 2, 2, '#');
      expect(result).toBe('12######90');
    });

    it('should handle empty or invalid input', () => {
      expect(maskSensitiveString('', 4, 4)).toBe('');
      expect(maskSensitiveString(null as any, 4, 4)).toBe('');
    });
  });

  describe('maskOAuthToken', () => {
    it('should mask access token', () => {
      const token: OAuthToken = {
        accessToken: 'very-long-secret-token-value',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2024-01-15T13:00:00Z',
        scope: 'read write'
      };

      const masked = maskOAuthToken(token);

      expect(masked.accessToken).toBe('very-l******************alue');
      expect(masked.tokenType).toBe('Bearer');
      expect(masked.expiresIn).toBe(3600);
      expect(masked.scope).toBe('read write');
    });
  });

  describe('maskCaseDetails', () => {
    it('should mask sensitive case information', () => {
      const caseDetails: CaseDetails = {
        caseNumber: 'ABC1234567890',
        currentStatus: 'Approved',
        processingCenter: 'NBC',
        priorityDate: '2023-01-15',
        caseType: 'I-485',
        lastUpdated: '2024-01-15T12:00:00Z',
        verificationId: 'VER123456'
      };

      const masked = maskCaseDetails(caseDetails);

      expect(masked.caseNumber).toBe('ABC******7890');
      expect(masked.verificationId).toBe('VE*****56');
      expect(masked.currentStatus).toBe('Approved'); // Not masked
      expect(masked.processingCenter).toBe('NBC'); // Not masked
    });

    it('should handle missing optional fields', () => {
      const caseDetails: CaseDetails = {
        currentStatus: 'Pending',
        processingCenter: 'NBC',
        priorityDate: '2023-01-15',
        caseType: 'I-485',
        lastUpdated: '2024-01-15T12:00:00Z'
      };

      const masked = maskCaseDetails(caseDetails);

      expect(masked.caseNumber).toBeUndefined();
      expect(masked.verificationId).toBeUndefined();
      expect(masked.currentStatus).toBe('Pending');
    });
  });

  describe('maskProcessingResult', () => {
    it('should mask all sensitive data in processing result', () => {
      const result: ProcessingResult = {
        baseURL: 'https://api.example.com',
        authMode: 'oauth',
        tokenHint: 'secret-hint-value',
        config: {
          apiKey: 'secret-api-key',
          publicUrl: 'https://public.example.com'
        },
        oauthToken: {
          accessToken: 'secret-access-token',
          tokenType: 'Bearer',
          expiresIn: 3600,
          expiresAt: '2024-01-15T13:00:00Z'
        }
      };

      const masked = maskProcessingResult(result);

      expect(masked.tokenHint).toBe('sec***********lue');
      expect(masked.oauthToken?.accessToken).toContain('****');
      expect(masked.config.apiKey).toContain('**');
      expect(masked.config.publicUrl).toBe('https://public.example.com'); // Not masked
    });
  });

  describe('maskConfigObject', () => {
    it('should mask sensitive configuration values', () => {
      const config = {
        apiKey: 'secret-key',
        clientSecret: 'secret-value',
        publicUrl: 'https://example.com',
        token: 'secret-token'
      };

      const masked = maskConfigObject(config);

      expect(masked.apiKey).toContain('**');
      expect(masked.clientSecret).toContain('**');
      expect(masked.token).toContain('**');
      expect(masked.publicUrl).toBe('https://example.com');
    });
  });

  describe('sanitizeForLogging', () => {
    it('should redact all sensitive information', () => {
      const data = {
        user: 'john',
        token: 'secret-token',
        password: 'secret-password',
        apiKey: 'secret-key',
        publicData: 'visible'
      };

      const sanitized = sanitizeForLogging(data);

      expect(sanitized.user).toBe('john');
      expect(sanitized.publicData).toBe('visible');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
    });

    it('should handle nested objects', () => {
      const data = {
        config: {
          database: {
            password: 'db-secret',
            host: 'localhost'
          }
        }
      };

      const sanitized = sanitizeForLogging(data);

      expect(sanitized.config.database.password).toBe('[REDACTED]');
      expect(sanitized.config.database.host).toBe('localhost');
    });

    it('should handle arrays', () => {
      const data = {
        tokens: ['token1', 'token2'],
        users: ['user1', 'user2']
      };

      const sanitized = sanitizeForLogging(data);

      // The 'tokens' key itself is sensitive, so the whole array gets redacted
      expect(sanitized.tokens).toBe('[REDACTED]');
      expect(sanitized.users).toEqual(['user1', 'user2']);
    });
  });

  describe('validateMaskedData', () => {
    it('should detect properly masked data', () => {
      const data = {
        token: 'abc****def',
        secret: '[REDACTED]',
        publicData: 'visible'
      };

      const result = validateMaskedData(data);

      expect(result.isValid).toBe(true);
      expect(result.exposedFields).toHaveLength(0);
    });

    it('should detect exposed sensitive data', () => {
      const data = {
        token: 'very-long-unmasked-token-value',
        secret: 'unmasked-secret',
        publicData: 'visible'
      };

      const result = validateMaskedData(data);

      expect(result.isValid).toBe(false);
      expect(result.exposedFields).toContain('token');
      expect(result.exposedFields).toContain('secret');
    });
  });

  describe('generateSecureId', () => {
    it('should generate IDs of correct length', () => {
      const id = generateSecureId(16);
      expect(id).toHaveLength(16);
    });

    it('should generate different IDs', () => {
      const id1 = generateSecureId();
      const id2 = generateSecureId();
      expect(id1).not.toBe(id2);
    });

    it('should only contain valid characters', () => {
      const id = generateSecureId(100);
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  describe('simpleHash', () => {
    it('should generate consistent hashes', () => {
      const hash1 = simpleHash('test string');
      const hash2 = simpleHash('test string');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const hash1 = simpleHash('string1');
      const hash2 = simpleHash('string2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty strings', () => {
      const hash = simpleHash('');
      expect(hash).toBe('0');
    });
  });

  describe('containsSensitiveData', () => {
    it('should detect email addresses', () => {
      const result = containsSensitiveData('Contact us at test@example.com');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.detectedPatterns).toContain('Email');
    });

    it('should detect phone numbers', () => {
      const result = containsSensitiveData('Call us at 555-123-4567');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.detectedPatterns).toContain('Phone');
    });

    it('should detect SSN', () => {
      const result = containsSensitiveData('SSN: 123-45-6789');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.detectedPatterns).toContain('SSN');
    });

    it('should detect API keys', () => {
      const result = containsSensitiveData('API key: abcdef1234567890abcdef1234567890ab');
      expect(result.hasSensitiveData).toBe(true);
      expect(result.detectedPatterns).toContain('API Key');
    });

    it('should return false for clean text', () => {
      const result = containsSensitiveData('This is just normal text');
      expect(result.hasSensitiveData).toBe(false);
      expect(result.detectedPatterns).toHaveLength(0);
    });
  });

  describe('secureCompare', () => {
    it('should return true for identical strings', () => {
      expect(secureCompare('test', 'test')).toBe(true);
      expect(secureCompare('', '')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(secureCompare('test1', 'test2')).toBe(false);
      expect(secureCompare('test', 'TEST')).toBe(false);
    });

    it('should return false for different lengths', () => {
      expect(secureCompare('test', 'testing')).toBe(false);
    });

    it('should handle non-string inputs', () => {
      expect(secureCompare(null as any, 'test')).toBe(false);
      expect(secureCompare('test', undefined as any)).toBe(false);
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should sanitize error messages with tokens', () => {
      const error = new Error('Authentication failed with token=abc123def456');
      const sanitized = sanitizeErrorMessage(error);
      expect(sanitized).toBe('Authentication failed with token=[REDACTED]');
    });

    it('should sanitize string error messages', () => {
      const sanitized = sanitizeErrorMessage('Failed with secret=mysecret');
      expect(sanitized).toBe('Failed with secret=[REDACTED]');
    });

    it('should sanitize email addresses', () => {
      const sanitized = sanitizeErrorMessage('User test@example.com not found');
      expect(sanitized).toBe('User [EMAIL_REDACTED] not found');
    });

    it('should handle empty or null errors', () => {
      expect(sanitizeErrorMessage(new Error(''))).toBe('An unknown error occurred');
      expect(sanitizeErrorMessage('')).toBe('An unknown error occurred');
    });
  });

  describe('getSecuritySettings', () => {
    it('should return development settings', () => {
      const settings = getSecuritySettings('development');
      expect(settings.maskingEnabled).toBe(false);
      expect(settings.showSensitiveData).toBe(true);
      expect(settings.loggingLevel).toBe('debug');
    });

    it('should return staging settings', () => {
      const settings = getSecuritySettings('staging');
      expect(settings.maskingEnabled).toBe(true);
      expect(settings.showSensitiveData).toBe(false);
      expect(settings.loggingLevel).toBe('info');
    });

    it('should return production settings', () => {
      const settings = getSecuritySettings('production');
      expect(settings.maskingEnabled).toBe(true);
      expect(settings.showSensitiveData).toBe(false);
      expect(settings.loggingLevel).toBe('error');
    });

    it('should default to production settings for unknown environments', () => {
      const settings = getSecuritySettings('unknown');
      expect(settings).toEqual(getSecuritySettings('production'));
    });
  });
});