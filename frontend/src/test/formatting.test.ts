import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatProcessingTime,
  formatTokenExpiration,
  formatCaseStatus,
  formatEnvironment,
  formatFileSize,
  formatPercentage,
  formatJsonForDisplay,
  truncateText,
  formatCaseNumber
} from '../utils/formatting';
import type { Environment } from '../types';

describe('Formatting Utilities', () => {
  beforeEach(() => {
    // Mock Date.now() for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('should format valid date strings', () => {
      expect(formatDate('2024-01-15T12:00:00Z')).toBe('Jan 15, 2024');
      // Use a date that won't be affected by timezone issues
      expect(formatDate('2023-12-25T12:00:00Z')).toBe('Dec 25, 2023');
    });

    it('should handle custom options', () => {
      const options = { year: 'numeric', month: 'long', day: 'numeric' } as const;
      expect(formatDate('2024-01-15T12:00:00Z', options)).toBe('January 15, 2024');
    });

    it('should handle invalid dates', () => {
      expect(formatDate('invalid-date')).toBe('Invalid Date');
      expect(formatDate('')).toBe('N/A');
      expect(formatDate(null as any)).toBe('N/A');
    });
  });

  describe('formatDateTime', () => {
    it('should format date with time', () => {
      const result = formatDateTime('2024-01-15T12:30:00Z');
      expect(result).toContain('Jan 15, 2024');
      expect(result).toMatch(/\d{1,2}:\d{2}/); // Should contain time in HH:MM format
    });

    it('should handle invalid dates', () => {
      expect(formatDateTime('invalid')).toBe('Invalid Date');
      expect(formatDateTime('')).toBe('N/A');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format recent times', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe('5 minutes ago');
    });

    it('should format future times', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      
      expect(formatRelativeTime(inTwoHours.toISOString())).toBe('in 2 hours');
    });

    it('should format very recent times', () => {
      const now = new Date('2024-01-15T12:00:00Z');
      const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
      
      expect(formatRelativeTime(thirtySecondsAgo.toISOString())).toBe('just now');
    });

    it('should handle old dates', () => {
      const oldDate = '2023-01-15T12:00:00Z';
      expect(formatRelativeTime(oldDate)).toBe('Jan 15, 2023');
    });

    it('should handle invalid dates', () => {
      expect(formatRelativeTime('invalid')).toBe('Invalid Date');
      expect(formatRelativeTime('')).toBe('N/A');
    });
  });

  describe('formatProcessingTime', () => {
    it('should format milliseconds', () => {
      expect(formatProcessingTime(500)).toBe('500ms');
      expect(formatProcessingTime(0)).toBe('0ms');
    });

    it('should format seconds', () => {
      expect(formatProcessingTime(1500)).toBe('1.5s');
      expect(formatProcessingTime(30000)).toBe('30.0s');
    });

    it('should format minutes', () => {
      expect(formatProcessingTime(90000)).toBe('1.5m'); // 90 seconds
      expect(formatProcessingTime(180000)).toBe('3.0m'); // 3 minutes
    });

    it('should format hours', () => {
      expect(formatProcessingTime(3600000)).toBe('1.0h'); // 1 hour
      expect(formatProcessingTime(7200000)).toBe('2.0h'); // 2 hours
    });

    it('should handle invalid input', () => {
      expect(formatProcessingTime(-100)).toBe('N/A');
      expect(formatProcessingTime(NaN)).toBe('N/A');
      expect(formatProcessingTime('invalid' as any)).toBe('N/A');
    });
  });

  describe('formatTokenExpiration', () => {
    it('should format valid expiration times', () => {
      const inFiveMinutes = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      const result = formatTokenExpiration(inFiveMinutes);
      
      expect(result.timeLeft).toBe('5m');
      expect(result.isExpired).toBe(false);
      expect(result.isExpiringSoon).toBe(false);
    });

    it('should detect expired tokens', () => {
      const expired = new Date(Date.now() - 1000).toISOString();
      const result = formatTokenExpiration(expired);
      
      expect(result.timeLeft).toBe('Expired');
      expect(result.isExpired).toBe(true);
      expect(result.isExpiringSoon).toBe(false);
    });

    it('should detect expiring soon tokens', () => {
      const expiringSoon = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 minutes
      const result = formatTokenExpiration(expiringSoon);
      
      expect(result.isExpiringSoon).toBe(true);
      expect(result.isExpired).toBe(false);
    });

    it('should handle invalid dates', () => {
      const result = formatTokenExpiration('invalid');
      expect(result.timeLeft).toBe('Invalid Date');
      expect(result.isExpired).toBe(false);
    });

    it('should handle empty input', () => {
      const result = formatTokenExpiration('');
      expect(result.timeLeft).toBe('Unknown');
    });
  });

  describe('formatCaseStatus', () => {
    it('should format approved status', () => {
      const result = formatCaseStatus('approved');
      expect(result.formatted).toBe('Approved');
      expect(result.color).toBe('text-green-700');
      expect(result.bgColor).toBe('bg-green-100');
    });

    it('should format pending status', () => {
      const result = formatCaseStatus('pending');
      expect(result.formatted).toBe('Pending');
      expect(result.color).toBe('text-yellow-700');
    });

    it('should format denied status', () => {
      const result = formatCaseStatus('denied');
      expect(result.formatted).toBe('Denied');
      expect(result.color).toBe('text-red-700');
    });

    it('should handle unknown status', () => {
      const result = formatCaseStatus('unknown-status');
      expect(result.formatted).toBe('Unknown-status');
      expect(result.color).toBe('text-gray-700');
    });

    it('should handle empty status', () => {
      const result = formatCaseStatus('');
      expect(result.formatted).toBe('Unknown');
      expect(result.color).toBe('text-gray-600');
    });
  });

  describe('formatEnvironment', () => {
    it('should format development environment', () => {
      const result = formatEnvironment('development');
      expect(result.formatted).toBe('Development');
      expect(result.color).toBe('text-blue-700');
    });

    it('should format staging environment', () => {
      const result = formatEnvironment('staging');
      expect(result.formatted).toBe('Staging');
      expect(result.color).toBe('text-yellow-700');
    });

    it('should format production environment', () => {
      const result = formatEnvironment('production');
      expect(result.formatted).toBe('Production');
      expect(result.color).toBe('text-red-700');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(512)).toBe('512 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(2097152)).toBe('2 MB');
    });

    it('should handle invalid input', () => {
      expect(formatFileSize(-100)).toBe('N/A');
      expect(formatFileSize(NaN)).toBe('N/A');
      expect(formatFileSize('invalid' as any)).toBe('N/A');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages with default decimals', () => {
      expect(formatPercentage(50)).toBe('50.0%');
      expect(formatPercentage(33.333)).toBe('33.3%');
    });

    it('should format percentages with custom decimals', () => {
      expect(formatPercentage(33.333, 2)).toBe('33.33%');
      expect(formatPercentage(50, 0)).toBe('50%');
    });

    it('should handle invalid input', () => {
      expect(formatPercentage(NaN)).toBe('N/A');
      expect(formatPercentage('invalid' as any)).toBe('N/A');
    });
  });

  describe('formatJsonForDisplay', () => {
    it('should format valid objects', () => {
      const obj = { name: 'test', value: 123 };
      const result = formatJsonForDisplay(obj);
      expect(result).toContain('"name": "test"');
      expect(result).toContain('"value": 123');
    });

    it('should handle custom indentation', () => {
      const obj = { test: true };
      const result = formatJsonForDisplay(obj, 4);
      expect(result).toContain('    "test": true');
    });

    it('should handle invalid objects', () => {
      const circular: any = {};
      circular.self = circular;
      expect(formatJsonForDisplay(circular)).toBe('Invalid JSON');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated';
      expect(truncateText(longText, 20)).toBe('This is a very lo...');
    });

    it('should not truncate short text', () => {
      const shortText = 'Short text';
      expect(truncateText(shortText, 20)).toBe('Short text');
    });

    it('should handle edge cases', () => {
      expect(truncateText('', 10)).toBe('');
      expect(truncateText(null as any, 10)).toBe('');
      expect(truncateText('test', 4)).toBe('test');
      expect(truncateText('test', 3)).toBe('tes');
    });
  });

  describe('formatCaseNumber', () => {
    it('should format standard case numbers', () => {
      expect(formatCaseNumber('ABC1234567890')).toBe('ABC 123 456 7890');
      expect(formatCaseNumber('MSC2109876543')).toBe('MSC 210 987 6543');
    });

    it('should handle case numbers with existing formatting', () => {
      expect(formatCaseNumber('ABC 123 456 7890')).toBe('ABC 123 456 7890');
      expect(formatCaseNumber('ABC-123-456-7890')).toBe('ABC 123 456 7890');
    });

    it('should handle short case numbers', () => {
      expect(formatCaseNumber('ABC123')).toBe('ABC123');
    });

    it('should handle invalid input', () => {
      expect(formatCaseNumber('')).toBe('N/A');
      expect(formatCaseNumber(null as any)).toBe('N/A');
    });
  });
});