import type { OAuthToken, CaseDetails, ProcessingResult } from '../types';

/**
 * Security utilities for data masking and protection
 */

/**
 * Mask sensitive string data by showing only first and last few characters
 */
export const maskSensitiveString = (
  value: string, 
  visibleStart: number = 4, 
  visibleEnd: number = 4,
  maskChar: string = '*'
): string => {
  if (!value || typeof value !== 'string') {
    return '';
  }
  
  if (value.length <= visibleStart + visibleEnd) {
    // If string is too short, mask most of it but leave at least one character visible
    const visibleChars = Math.max(1, Math.floor(value.length / 3));
    return value.substring(0, visibleChars) + maskChar.repeat(value.length - visibleChars);
  }
  
  const start = value.substring(0, visibleStart);
  const end = value.substring(value.length - visibleEnd);
  const maskLength = value.length - visibleStart - visibleEnd;
  
  return `${start}${maskChar.repeat(maskLength)}${end}`;
};

/**
 * Mask OAuth token for display purposes
 */
export const maskOAuthToken = (token: OAuthToken): Partial<OAuthToken> => {
  return {
    ...token,
    accessToken: maskSensitiveString(token.accessToken, 6, 4)
  };
};

/**
 * Mask sensitive fields in case details
 */
export const maskCaseDetails = (caseDetails: CaseDetails): CaseDetails => {
  return {
    ...caseDetails,
    // Mask case number if present (show first 3 letters and last 4 digits)
    caseNumber: caseDetails.caseNumber 
      ? maskSensitiveString(caseDetails.caseNumber, 3, 4)
      : caseDetails.caseNumber,
    // Mask verification ID if present
    verificationId: caseDetails.verificationId
      ? maskSensitiveString(caseDetails.verificationId, 2, 2)
      : caseDetails.verificationId
  };
};

/**
 * Mask sensitive data in processing result for logging/display
 */
export const maskProcessingResult = (result: ProcessingResult): ProcessingResult => {
  const masked: ProcessingResult = {
    ...result,
    // Mask token hint
    tokenHint: maskSensitiveString(result.tokenHint, 3, 3),
    // Mask OAuth token if present
    oauthToken: result.oauthToken ? maskOAuthToken(result.oauthToken) : result.oauthToken,
    // Mask case details if present
    caseDetails: result.caseDetails ? maskCaseDetails(result.caseDetails) : result.caseDetails,
    // Mask sensitive config values
    config: maskConfigObject(result.config)
  };
  
  return masked;
};

/**
 * Mask sensitive values in configuration object
 */
export const maskConfigObject = (config: Record<string, string>): Record<string, string> => {
  const masked: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(config)) {
    const lowerKey = key.toLowerCase();
    
    // Identify sensitive keys
    const isSensitive = lowerKey.includes('secret') || 
                       lowerKey.includes('token') || 
                       lowerKey.includes('password') || 
                       lowerKey.includes('key') ||
                       lowerKey.includes('credential');
    
    if (isSensitive && typeof value === 'string') {
      masked[key] = maskSensitiveString(value, 2, 2);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
};

/**
 * Sanitize data for safe logging (removes/masks all sensitive information)
 */
export const sanitizeForLogging = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  // Deep clone to avoid mutating original
  const sanitized = JSON.parse(JSON.stringify(data));
  
  const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitizeObject(item));
    }
    
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const lowerKey = key.toLowerCase();
        
        // List of sensitive field patterns
        const sensitivePatterns = [
          'token', 'secret', 'password', 'credential', 'key', 'auth',
          'client_secret', 'access_token', 'refresh_token', 'api_key',
          'private', 'confidential', 'secure'
        ];
        
        const isSensitive = sensitivePatterns.some(pattern => 
          lowerKey.includes(pattern)
        );
        
        if (isSensitive) {
          if (typeof obj[key] === 'string') {
            obj[key] = '[REDACTED]';
          } else {
            obj[key] = '[REDACTED]';
          }
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
    }
    
    return obj;
  };
  
  return sanitizeObject(sanitized);
};

/**
 * Validate that sensitive data is properly masked before display
 */
export const validateMaskedData = (data: any): {
  isValid: boolean;
  exposedFields: string[];
} => {
  const exposedFields: string[] = [];
  
  const checkObject = (obj: any, path: string = ''): void => {
    if (!obj || typeof obj !== 'object') {
      return;
    }
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        checkObject(item, `${path}[${index}]`);
      });
      return;
    }
    
    for (const key in obj) {
      if (Object.hasOwn(obj, key)) {
        const currentPath = path ? `${path}.${key}` : key;
        const lowerKey = key.toLowerCase();
        
        // Check if this is a sensitive field
        const isSensitive = lowerKey.includes('token') || 
                           lowerKey.includes('secret') || 
                           lowerKey.includes('password') ||
                           lowerKey.includes('credential');
        
        if (isSensitive && typeof obj[key] === 'string') {
          // Check if the value appears to be unmasked (no asterisks or [REDACTED])
          const value = obj[key];
          if (!value.includes('*') && !value.includes('[REDACTED]') && value.length > 8) {
            exposedFields.push(currentPath);
          }
        } else if (typeof obj[key] === 'object') {
          checkObject(obj[key], currentPath);
        }
      }
    }
  };
  
  checkObject(data);
  
  return {
    isValid: exposedFields.length === 0,
    exposedFields
  };
};

/**
 * Generate a secure random string for IDs or tokens
 */
export const generateSecureId = (length: number = 16): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  // Use crypto.getRandomValues if available (browser environment)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    // Fallback to Math.random (less secure)
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
};

/**
 * Hash a string using a simple hash function (for non-cryptographic purposes)
 */
export const simpleHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(36);
};

/**
 * Check if a string contains potentially sensitive information
 */
export const containsSensitiveData = (text: string): {
  hasSensitiveData: boolean;
  detectedPatterns: string[];
} => {
  if (!text || typeof text !== 'string') {
    return { hasSensitiveData: false, detectedPatterns: [] };
  }
  
  const sensitivePatterns = [
    { name: 'Email', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
    { name: 'Phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
    { name: 'SSN', pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g },
    { name: 'Credit Card', pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g },
    { name: 'API Key', pattern: /\b[A-Za-z0-9]{32,}\b/g },
    { name: 'JWT Token', pattern: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*\b/g }
  ];
  
  const detectedPatterns: string[] = [];
  
  for (const { name, pattern } of sensitivePatterns) {
    if (pattern.test(text)) {
      detectedPatterns.push(name);
    }
  }
  
  return {
    hasSensitiveData: detectedPatterns.length > 0,
    detectedPatterns
  };
};

/**
 * Secure comparison of strings to prevent timing attacks
 */
export const secureCompare = (a: string, b: string): boolean => {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
};

/**
 * Clean sensitive data from error messages
 */
export const sanitizeErrorMessage = (error: Error | string): string => {
  const message = typeof error === 'string' ? error : error.message;
  
  if (!message) {
    return 'An unknown error occurred';
  }
  
  // Remove common sensitive patterns from error messages
  const sanitized = message
    .replace(/token[=:]\s*[A-Za-z0-9+/=]+/gi, 'token=[REDACTED]')
    .replace(/secret[=:]\s*[A-Za-z0-9+/=]+/gi, 'secret=[REDACTED]')
    .replace(/password[=:]\s*[A-Za-z0-9+/=]+/gi, 'password=[REDACTED]')
    .replace(/key[=:]\s*[A-Za-z0-9+/=]+/gi, 'key=[REDACTED]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]');
  
  return sanitized;
};

/**
 * Environment-specific security settings
 */
export const getSecuritySettings = (environment: string) => {
  const settings = {
    development: {
      maskingEnabled: false,
      loggingLevel: 'debug',
      showSensitiveData: true,
      validateCertificates: false
    },
    staging: {
      maskingEnabled: true,
      loggingLevel: 'info',
      showSensitiveData: false,
      validateCertificates: true
    },
    production: {
      maskingEnabled: true,
      loggingLevel: 'error',
      showSensitiveData: false,
      validateCertificates: true
    }
  };
  
  return settings[environment as keyof typeof settings] || settings.production;
};