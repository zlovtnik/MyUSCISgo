import { describe, it, expect } from 'vitest';
import {
  validateCredentials,
  validateClientId,
  validateClientSecret,
  validateEnvironment,
  validateOAuthTokenEnhanced,
  validateCaseDetailsEnhanced,
  validateProcessingMetadataEnhanced,
  validateRealtimeUpdateEnhanced,
  validateUrl,
  validateJsonString
} from '../utils/validation';
import type { Credentials, OAuthToken, CaseDetails, ProcessingMetadata, RealtimeUpdate } from '../types';

describe('Enhanced Validation Utilities', () => {
  describe('validateCredentials', () => {
    it('should validate complete valid credentials', () => {
      const credentials: Credentials = {
        clientId: 'valid-client-id',
        clientSecret: 'ValidSecret123!',
        environment: 'development'
      };

      const result = validateCredentials(credentials);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const credentials = {} as Partial<Credentials>;

      const result = validateCredentials(credentials);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Client ID is required');
      expect(result.errors).toContain('Client Secret is required');
      expect(result.errors).toContain('Environment is required');
    });

    it('should validate individual field errors', () => {
      const credentials: Partial<Credentials> = {
        clientId: 'ab', // Too short
        clientSecret: '123', // Too short
        environment: 'invalid' as any
      };

      const result = validateCredentials(credentials);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('at least 3 characters'))).toBe(true);
      expect(result.errors.some(e => e.includes('at least 8 characters'))).toBe(true);
    });
  });

  describe('validateClientId', () => {
    it('should validate correct client IDs', () => {
      const result = validateClientId('valid-client-id-123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid characters', () => {
      const result = validateClientId('invalid@client#id');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Client ID can only contain letters, numbers, dots, hyphens, and underscores');
    });

    it('should detect length issues', () => {
      expect(validateClientId('ab').isValid).toBe(false);
      expect(validateClientId('a'.repeat(101)).isValid).toBe(false);
    });

    it('should warn about test credentials', () => {
      const result = validateClientId('test-client-id');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Client ID appears to be a test/demo credential');
    });

    it('should warn about short IDs', () => {
      const result = validateClientId('short12');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Client ID is shorter than recommended (8+ characters)');
    });
  });

  describe('validateClientSecret', () => {
    it('should validate strong secrets', () => {
      const result = validateClientSecret('StrongSecret123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require minimum length', () => {
      const result = validateClientSecret('short');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Client Secret must be at least 8 characters long');
    });

    it('should require letters and numbers', () => {
      const result = validateClientSecret('onlyletters');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Client Secret must contain at least one number');
    });

    it('should warn about weak patterns', () => {
      const result = validateClientSecret('password123');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Client Secret appears to use a common or weak pattern');
    });

    it('should warn about missing complexity', () => {
      const result = validateClientSecret('simple123');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Client Secret should contain special characters for better security');
    });
  });

  describe('validateEnvironment', () => {
    it('should validate correct environments', () => {
      expect(validateEnvironment('development').isValid).toBe(true);
      expect(validateEnvironment('staging').isValid).toBe(true);
      expect(validateEnvironment('production').isValid).toBe(true);
    });

    it('should reject invalid environments', () => {
      const result = validateEnvironment('invalid');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Environment must be one of: development, staging, production');
    });
  });

  describe('validateOAuthTokenEnhanced', () => {
    it('should validate complete valid token', () => {
      const token: OAuthToken = {
        accessToken: 'valid-access-token-123',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2024-01-15T13:00:00Z',
        scope: 'read write'
      };

      const result = validateOAuthTokenEnhanced(token);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const token = {} as any;

      const result = validateOAuthTokenEnhanced(token);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Access token must be a non-empty string');
      expect(result.errors).toContain('Token type must be a non-empty string');
    });

    it('should warn about unusual token characteristics', () => {
      const token = {
        accessToken: 'short',
        tokenType: 'Custom',
        expiresIn: 100, // Very short expiration
        expiresAt: '2024-01-15T13:00:00Z'
      };

      const result = validateOAuthTokenEnhanced(token);
      
      expect(result.warnings).toContain('Access token appears to be unusually short');
      expect(result.warnings).toContain("Token type 'Custom' is not a standard type");
      expect(result.warnings).toContain('Token expires in less than 5 minutes');
    });

    it('should detect expired tokens', () => {
      const token = {
        accessToken: 'valid-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2020-01-15T13:00:00Z' // Past date
      };

      const result = validateOAuthTokenEnhanced(token);
      expect(result.warnings).toContain('Token has already expired');
    });
  });

  describe('validateCaseDetailsEnhanced', () => {
    it('should validate complete case details', () => {
      const caseDetails: CaseDetails = {
        caseNumber: 'ABC1234567890',
        currentStatus: 'approved',
        processingCenter: 'National Benefits Center',
        priorityDate: '2023-01-15T00:00:00Z',
        caseType: 'I-485',
        lastUpdated: '2024-01-15T12:00:00Z',
        verificationId: 'VER123'
      };

      const result = validateCaseDetailsEnhanced(caseDetails);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const caseDetails = {} as any;

      const result = validateCaseDetailsEnhanced(caseDetails);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Current status must be a non-empty string');
      expect(result.errors).toContain('Processing center must be a non-empty string');
    });

    it('should warn about non-standard status', () => {
      const caseDetails = {
        currentStatus: 'custom-status',
        processingCenter: 'NBC',
        priorityDate: '2023-01-15',
        caseType: 'I-485',
        lastUpdated: '2024-01-15T12:00:00Z'
      };

      const result = validateCaseDetailsEnhanced(caseDetails);
      expect(result.warnings).toContain("Status 'custom-status' is not a recognized standard status");
    });

    it('should warn about old case updates', () => {
      const caseDetails = {
        currentStatus: 'pending',
        processingCenter: 'NBC',
        priorityDate: '2023-01-15',
        caseType: 'I-485',
        lastUpdated: '2020-01-15T12:00:00Z' // Very old
      };

      const result = validateCaseDetailsEnhanced(caseDetails);
      expect(result.warnings).toContain('Case has not been updated in over a year');
    });

    it('should validate case number format', () => {
      const caseDetails = {
        caseNumber: 'INVALID123',
        currentStatus: 'pending',
        processingCenter: 'NBC',
        priorityDate: '2023-01-15',
        caseType: 'I-485',
        lastUpdated: '2024-01-15T12:00:00Z'
      };

      const result = validateCaseDetailsEnhanced(caseDetails);
      expect(result.warnings).toContain('Case number format does not match typical USCIS format');
    });
  });

  describe('validateProcessingMetadataEnhanced', () => {
    it('should validate complete metadata', () => {
      const metadata: ProcessingMetadata = {
        environment: 'development',
        processingTime: 1500,
        requestId: 'req-123',
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validateProcessingMetadataEnhanced(metadata);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid processing time', () => {
      const metadata = {
        environment: 'development',
        processingTime: -100,
        requestId: 'req-123',
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validateProcessingMetadataEnhanced(metadata);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Processing time cannot be negative');
    });

    it('should warn about long processing times', () => {
      const metadata = {
        environment: 'development',
        processingTime: 400000, // Over 5 minutes
        requestId: 'req-123',
        timestamp: '2024-01-15T12:00:00Z'
      };

      const result = validateProcessingMetadataEnhanced(metadata);
      expect(result.warnings).toContain('Processing time is unusually long (over 5 minutes)');
    });
  });

  describe('validateRealtimeUpdateEnhanced', () => {
    it('should validate complete update', () => {
      const update: RealtimeUpdate = {
        id: 'update-123',
        timestamp: '2024-01-15T12:00:00Z',
        step: 'validating',
        message: 'Validating credentials',
        level: 'info'
      };

      const result = validateRealtimeUpdateEnhanced(update);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const update = {} as any;

      const result = validateRealtimeUpdateEnhanced(update);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Update ID must be a non-empty string');
      expect(result.errors).toContain('Message must be a non-empty string');
    });

    it('should warn about unrecognized steps', () => {
      const update = {
        id: 'update-123',
        timestamp: '2024-01-15T12:00:00Z',
        step: 'custom-step',
        message: 'Custom message',
        level: 'info'
      };

      const result = validateRealtimeUpdateEnhanced(update);
      expect(result.warnings).toContain("Step 'custom-step' is not a recognized processing step");
    });

    it('should validate level values', () => {
      const update = {
        id: 'update-123',
        timestamp: '2024-01-15T12:00:00Z',
        step: 'validating',
        message: 'Test message',
        level: 'invalid-level'
      };

      const result = validateRealtimeUpdateEnhanced(update);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Level must be one of: info, warning, error, success');
    });
  });

  describe('validateUrl', () => {
    it('should validate HTTPS URLs', () => {
      const result = validateUrl('https://api.example.com');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate HTTP URLs with warnings', () => {
      const result = validateUrl('http://api.example.com');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('HTTP URLs are not secure for production use');
    });

    it('should warn about localhost URLs', () => {
      const result = validateUrl('http://localhost:3000');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('URL appears to be a development/localhost URL');
    });

    it('should reject invalid protocols', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL must use HTTP or HTTPS protocol');
    });

    it('should reject malformed URLs', () => {
      const result = validateUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL format is invalid');
    });
  });

  describe('validateJsonString', () => {
    it('should validate correct JSON', () => {
      const result = validateJsonString('{"name": "test", "value": 123}');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid JSON', () => {
      const result = validateJsonString('{"invalid": json}');
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid JSON format');
    });

    it('should warn about null values', () => {
      const result = validateJsonString('null');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('JSON contains null value');
    });

    it('should warn about non-object JSON', () => {
      const result = validateJsonString('"just a string"');
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('JSON does not contain an object');
    });

    it('should handle empty input', () => {
      const result = validateJsonString('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('JSON must be a non-empty string');
    });
  });
});