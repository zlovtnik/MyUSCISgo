import { describe, it, expect } from 'vitest';
import { validateClientId, validateClientSecret } from '../utils';

describe('validateClientId', () => {
  it('returns null for valid client IDs', () => {
    expect(validateClientId('valid-client-123')).toBeNull();
    expect(validateClientId('test123')).toBeNull();
    expect(validateClientId('a-b-c')).toBeNull();
    expect(validateClientId('CLIENT-123')).toBeNull();
  });

  it('returns error for empty client ID', () => {
    expect(validateClientId('')).toBe('Client ID is required');
    expect(validateClientId('   ')).toBe('Client ID is required');
  });

  it('returns error for client ID too short', () => {
    expect(validateClientId('ab')).toBe('Client ID must be at least 3 characters');
    expect(validateClientId('a')).toBe('Client ID must be at least 3 characters');
  });

  it('returns error for client ID too long', () => {
    const longId = 'a'.repeat(101);
    expect(validateClientId(longId)).toBe('Client ID must be less than 100 characters');
  });

  it('returns error for invalid characters', () => {
    expect(validateClientId('test client')).toBe('Client ID must contain only alphanumeric characters and hyphens');
    expect(validateClientId('test@client')).toBe('Client ID must contain only alphanumeric characters and hyphens');
    expect(validateClientId('test.client')).toBe('Client ID must contain only alphanumeric characters and hyphens');
    expect(validateClientId('test_client')).toBe('Client ID must contain only alphanumeric characters and hyphens');
  });
});

describe('validateClientSecret', () => {
  it('returns null for valid client secrets', () => {
    expect(validateClientSecret('ValidSecret123')).toBeNull();
    expect(validateClientSecret('password123')).toBeNull();
    expect(validateClientSecret('MySecurePass456')).toBeNull();
    expect(validateClientSecret('a1b2c3d4e5f6g8')).toBeNull();
  });

  it('returns error for empty client secret', () => {
    expect(validateClientSecret('')).toBe('Client secret is required');
  });

  it('returns error for client secret too short', () => {
    expect(validateClientSecret('short')).toBe('Client secret must be at least 8 characters');
    expect(validateClientSecret('1234567')).toBe('Client secret must be at least 8 characters');
  });

  it('returns error for client secret too long', () => {
    const longSecret = 'a'.repeat(256);
    expect(validateClientSecret(longSecret)).toBe('Client secret must be less than 255 characters');
  });

  it('returns error for client secret without letters', () => {
    expect(validateClientSecret('12345678')).toBe('Client secret must contain at least one letter and one number');
  });

  it('returns error for client secret without numbers', () => {
    expect(validateClientSecret('abcdefgh')).toBe('Client secret must contain at least one letter and one number');
    expect(validateClientSecret('ABCDEFGH')).toBe('Client secret must contain at least one letter and one number');
  });

  it('accepts client secrets with special characters', () => {
    expect(validateClientSecret('Password123!')).toBeNull();
    expect(validateClientSecret('My@Secure#Pass$123')).toBeNull();
  });

  it('accepts minimum valid length', () => {
    expect(validateClientSecret('Pass1234')).toBeNull();
    expect(validateClientSecret('A1B2C3D4')).toBeNull();
  });
});
