import { describe, it, expect } from 'vitest';
import {
  isOAuthToken,
  isCaseDetails,
  isProcessingMetadata,
  isRealtimeUpdate,
  validateProcessingResult,
  validateOAuthToken,
  validateCaseDetails,
  type OAuthToken,
  type CaseDetails,
  type ProcessingMetadata,
  type ProcessingResult,
  type RealtimeUpdate
} from '../types';

describe('Type Guards', () => {
  describe('isOAuthToken', () => {
    it('should return true for valid OAuthToken', () => {
      const validToken: OAuthToken = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2024-01-01T00:00:00Z',
        scope: 'read'
      };
      expect(isOAuthToken(validToken)).toBe(true);
    });

    it('should return false for invalid OAuthToken', () => {
      expect(isOAuthToken(null)).toBe(false);
      expect(isOAuthToken({})).toBe(false);
      expect(isOAuthToken({ accessToken: 'test' })).toBe(false);
    });
  });

  describe('isCaseDetails', () => {
    it('should return true for valid CaseDetails', () => {
      const validCase: CaseDetails = {
        currentStatus: 'Approved',
        processingCenter: 'NBC',
        priorityDate: '2023-01-01',
        caseType: 'I-485',
        lastUpdated: '2024-01-01T00:00:00Z'
      };
      expect(isCaseDetails(validCase)).toBe(true);
    });

    it('should return false for invalid CaseDetails', () => {
      expect(isCaseDetails(null)).toBe(false);
      expect(isCaseDetails({})).toBe(false);
      expect(isCaseDetails({ currentStatus: 'test' })).toBe(false);
    });
  });

  describe('isProcessingMetadata', () => {
    it('should return true for valid ProcessingMetadata', () => {
      const validMetadata: ProcessingMetadata = {
        environment: 'development',
        processingTime: 1500,
        requestId: 'req-123',
        timestamp: '2024-01-01T00:00:00Z'
      };
      expect(isProcessingMetadata(validMetadata)).toBe(true);
    });

    it('should return false for invalid ProcessingMetadata', () => {
      expect(isProcessingMetadata(null)).toBe(false);
      expect(isProcessingMetadata({})).toBe(false);
      expect(isProcessingMetadata({ environment: 'test' })).toBe(false);
    });
  });

  describe('isRealtimeUpdate', () => {
    it('should return true for valid RealtimeUpdate', () => {
      const validUpdate: RealtimeUpdate = {
        id: 'update-1',
        timestamp: '2024-01-01T00:00:00Z',
        step: 'validating',
        message: 'Validating credentials',
        level: 'info'
      };
      expect(isRealtimeUpdate(validUpdate)).toBe(true);
    });

    it('should return false for invalid RealtimeUpdate', () => {
      expect(isRealtimeUpdate(null)).toBe(false);
      expect(isRealtimeUpdate({})).toBe(false);
      expect(isRealtimeUpdate({ id: 'test', level: 'invalid' })).toBe(false);
    });
  });
});

describe('Validation Functions', () => {
  describe('validateOAuthToken', () => {
    it('should validate correct OAuthToken', () => {
      const validToken: OAuthToken = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        expiresAt: '2024-01-01T00:00:00Z'
      };
      const result = validateOAuthToken(validToken);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid OAuthToken', () => {
      const invalidToken = {
        accessToken: '',
        tokenType: 'Bearer',
        expiresIn: -1,
        expiresAt: 'invalid-date'
      };
      const result = validateOAuthToken(invalidToken);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateCaseDetails', () => {
    it('should validate correct CaseDetails', () => {
      const validCase: CaseDetails = {
        currentStatus: 'Approved',
        processingCenter: 'NBC',
        priorityDate: '2023-01-01',
        caseType: 'I-485',
        lastUpdated: '2024-01-01T00:00:00Z'
      };
      const result = validateCaseDetails(validCase);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid CaseDetails', () => {
      const invalidCase = {
        currentStatus: '',
        processingCenter: 'NBC',
        priorityDate: '',
        caseType: 'I-485',
        lastUpdated: ''
      };
      const result = validateCaseDetails(invalidCase);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateProcessingResult', () => {
    it('should validate correct ProcessingResult', () => {
      const validResult: ProcessingResult = {
        baseURL: 'https://api.example.com',
        authMode: 'oauth',
        tokenHint: 'Bearer',
        config: { key: 'value' }
      };
      const result = validateProcessingResult(validResult);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid ProcessingResult', () => {
      const invalidResult = {
        baseURL: '',
        authMode: 'oauth',
        tokenHint: '',
        config: null
      };
      const result = validateProcessingResult(invalidResult);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});