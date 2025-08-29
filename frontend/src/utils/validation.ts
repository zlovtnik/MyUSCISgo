import type { 
  Credentials, 
  Environment, 
  OAuthToken, 
  CaseDetails, 
  ProcessingMetadata,
  ProcessingResult,
  RealtimeUpdate,
  ProcessingStep
} from '../types';

/**
 * Enhanced validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate credentials with enhanced checks
 */
export const validateCredentials = (credentials: Partial<Credentials>): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Client ID validation
  if (!credentials.clientId) {
    errors.push('Client ID is required');
  } else {
    const clientIdResult = validateClientId(credentials.clientId);
    if (clientIdResult.errors.length > 0) {
      errors.push(...clientIdResult.errors);
    }
    if (clientIdResult.warnings.length > 0) {
      warnings.push(...clientIdResult.warnings);
    }
  }
  
  // Client Secret validation
  if (!credentials.clientSecret) {
    errors.push('Client Secret is required');
  } else {
    const clientSecretResult = validateClientSecret(credentials.clientSecret);
    if (clientSecretResult.errors.length > 0) {
      errors.push(...clientSecretResult.errors);
    }
    if (clientSecretResult.warnings.length > 0) {
      warnings.push(...clientSecretResult.warnings);
    }
  }
  
  // Environment validation
  if (!credentials.environment) {
    errors.push('Environment is required');
  } else {
    const envResult = validateEnvironment(credentials.environment);
    if (!envResult.isValid) {
      errors.push(...envResult.errors);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Enhanced Client ID validation
 */
export const validateClientId = (clientId: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!clientId || typeof clientId !== 'string') {
    errors.push('Client ID must be a string');
    return { isValid: false, errors, warnings };
  }
  
  const trimmed = clientId.trim();
  
  if (trimmed.length === 0) {
    errors.push('Client ID cannot be empty');
  } else if (trimmed.length < 3) {
    errors.push('Client ID must be at least 3 characters long');
  } else if (trimmed.length > 100) {
    errors.push('Client ID must be less than 100 characters long');
  }
  
  // Check for valid characters (alphanumeric, hyphens, underscores, dots)
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    errors.push('Client ID can only contain letters, numbers, dots, hyphens, and underscores');
  }
  
  // Check for common patterns that might indicate test/demo credentials
  const testPatterns = ['test', 'demo', 'example', 'sample', 'fake'];
  if (testPatterns.some(pattern => trimmed.toLowerCase().includes(pattern))) {
    warnings.push('Client ID appears to be a test/demo credential');
  }
  
  // Check for suspicious patterns
  if (trimmed.length < 8) {
    warnings.push('Client ID is shorter than recommended (8+ characters)');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Enhanced Client Secret validation
 */
export const validateClientSecret = (clientSecret: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!clientSecret || typeof clientSecret !== 'string') {
    errors.push('Client Secret must be a string');
    return { isValid: false, errors, warnings };
  }
  
  const trimmed = clientSecret.trim();
  
  if (trimmed.length === 0) {
    errors.push('Client Secret cannot be empty');
  } else if (trimmed.length < 8) {
    errors.push('Client Secret must be at least 8 characters long');
  } else if (trimmed.length > 255) {
    errors.push('Client Secret must be less than 255 characters long');
  }
  
  // Check for basic complexity requirements
  const hasLowercase = /[a-z]/.test(trimmed);
  const hasUppercase = /[A-Z]/.test(trimmed);
  const hasNumber = /\d/.test(trimmed);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(trimmed);
  
  if (!hasLowercase && !hasUppercase) {
    errors.push('Client Secret must contain at least one letter');
  }
  
  if (!hasNumber) {
    errors.push('Client Secret must contain at least one number');
  }
  
  // Warnings for weak secrets
  if (trimmed.length < 16) {
    warnings.push('Client Secret is shorter than recommended (16+ characters)');
  }
  
  if (!hasSpecialChar) {
    warnings.push('Client Secret should contain special characters for better security');
  }
  
  if (!hasUppercase || !hasLowercase) {
    warnings.push('Client Secret should contain both uppercase and lowercase letters');
  }
  
  // Check for common weak patterns
  const weakPatterns = [
    /^(.)\1+$/, // All same character
    /^(012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i,
    /password|secret|admin|user|test|demo|example/i
  ];
  
  if (weakPatterns.some(pattern => pattern.test(trimmed))) {
    warnings.push('Client Secret appears to use a common or weak pattern');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate environment value
 */
export const validateEnvironment = (environment: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const validEnvironments: Environment[] = ['development', 'staging', 'production'];
  
  if (!environment || typeof environment !== 'string') {
    errors.push('Environment must be a string');
  } else if (!validEnvironments.includes(environment as Environment)) {
    errors.push(`Environment must be one of: ${validEnvironments.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Enhanced OAuth token validation
 */
export const validateOAuthTokenEnhanced = (token: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!token || typeof token !== 'object') {
    errors.push('OAuth token must be an object');
    return { isValid: false, errors, warnings };
  }
  
  // Access token validation
  if (!token.accessToken || typeof token.accessToken !== 'string') {
    errors.push('Access token must be a non-empty string');
  } else {
    if (token.accessToken.length < 10) {
      warnings.push('Access token appears to be unusually short');
    }
    if (token.accessToken.includes(' ')) {
      warnings.push('Access token contains spaces, which is unusual');
    }
  }
  
  // Token type validation
  if (!token.tokenType || typeof token.tokenType !== 'string') {
    errors.push('Token type must be a non-empty string');
  } else {
    const validTokenTypes = ['Bearer', 'Basic', 'Digest'];
    if (!validTokenTypes.includes(token.tokenType)) {
      warnings.push(`Token type '${token.tokenType}' is not a standard type`);
    }
  }
  
  // Expires in validation
  if (typeof token.expiresIn !== 'number') {
    errors.push('Expires in must be a number');
  } else {
    if (token.expiresIn <= 0) {
      errors.push('Expires in must be a positive number');
    } else if (token.expiresIn < 300) {
      warnings.push('Token expires in less than 5 minutes');
    } else if (token.expiresIn > 86400) {
      warnings.push('Token expires in more than 24 hours, which is unusual');
    }
  }
  
  // Expires at validation
  if (!token.expiresAt || typeof token.expiresAt !== 'string') {
    errors.push('Expires at must be a non-empty string');
  } else {
    try {
      const expirationDate = new Date(token.expiresAt);
      if (isNaN(expirationDate.getTime())) {
        errors.push('Expires at must be a valid date string');
      } else {
        const now = new Date();
        if (expirationDate <= now) {
          warnings.push('Token has already expired');
        }
      }
    } catch {
      errors.push('Expires at must be a valid date string');
    }
  }
  
  // Scope validation (optional)
  if (token.scope && typeof token.scope !== 'string') {
    errors.push('Scope must be a string if provided');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Enhanced case details validation
 */
export const validateCaseDetailsEnhanced = (caseDetails: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!caseDetails || typeof caseDetails !== 'object') {
    errors.push('Case details must be an object');
    return { isValid: false, errors, warnings };
  }
  
  // Current status validation
  if (!caseDetails.currentStatus || typeof caseDetails.currentStatus !== 'string') {
    errors.push('Current status must be a non-empty string');
  } else {
    const validStatuses = [
      'approved', 'pending', 'in review', 'under review', 'denied', 
      'rejected', 'withdrawn', 'terminated', 'ready for interview', 
      'interview scheduled'
    ];
    const normalizedStatus = caseDetails.currentStatus.toLowerCase().trim();
    if (!validStatuses.includes(normalizedStatus)) {
      warnings.push(`Status '${caseDetails.currentStatus}' is not a recognized standard status`);
    }
  }
  
  // Processing center validation
  if (!caseDetails.processingCenter || typeof caseDetails.processingCenter !== 'string') {
    errors.push('Processing center must be a non-empty string');
  }
  
  // Priority date validation
  if (!caseDetails.priorityDate || typeof caseDetails.priorityDate !== 'string') {
    errors.push('Priority date must be a non-empty string');
  } else {
    try {
      const priorityDate = new Date(caseDetails.priorityDate);
      if (isNaN(priorityDate.getTime())) {
        warnings.push('Priority date does not appear to be a valid date');
      }
    } catch {
      warnings.push('Priority date format is not recognized');
    }
  }
  
  // Case type validation
  if (!caseDetails.caseType || typeof caseDetails.caseType !== 'string') {
    errors.push('Case type must be a non-empty string');
  }
  
  // Last updated validation
  if (!caseDetails.lastUpdated || typeof caseDetails.lastUpdated !== 'string') {
    errors.push('Last updated must be a non-empty string');
  } else {
    try {
      const lastUpdated = new Date(caseDetails.lastUpdated);
      if (isNaN(lastUpdated.getTime())) {
        warnings.push('Last updated date does not appear to be valid');
      } else {
        const now = new Date();
        const daysDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 365) {
          warnings.push('Case has not been updated in over a year');
        } else if (daysDiff > 90) {
          warnings.push('Case has not been updated in over 90 days');
        }
      }
    } catch {
      warnings.push('Last updated date format is not recognized');
    }
  }
  
  // Optional field validations
  if (caseDetails.caseNumber && typeof caseDetails.caseNumber !== 'string') {
    errors.push('Case number must be a string if provided');
  } else if (caseDetails.caseNumber) {
    // Basic case number format validation
    const caseNumberPattern = /^[A-Z]{3}\d{10}$/;
    if (!caseNumberPattern.test(caseDetails.caseNumber.replace(/\s/g, ''))) {
      warnings.push('Case number format does not match typical USCIS format');
    }
  }
  
  if (caseDetails.approvalDate) {
    if (typeof caseDetails.approvalDate !== 'string') {
      errors.push('Approval date must be a string if provided');
    } else {
      try {
        const approvalDate = new Date(caseDetails.approvalDate);
        if (isNaN(approvalDate.getTime())) {
          warnings.push('Approval date does not appear to be valid');
        }
      } catch {
        warnings.push('Approval date format is not recognized');
      }
    }
  }
  
  if (caseDetails.verificationId && typeof caseDetails.verificationId !== 'string') {
    errors.push('Verification ID must be a string if provided');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate processing metadata
 */
export const validateProcessingMetadataEnhanced = (metadata: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!metadata || typeof metadata !== 'object') {
    errors.push('Processing metadata must be an object');
    return { isValid: false, errors, warnings };
  }
  
  // Environment validation
  if (!metadata.environment || typeof metadata.environment !== 'string') {
    errors.push('Environment must be a non-empty string');
  } else {
    const envResult = validateEnvironment(metadata.environment);
    if (!envResult.isValid) {
      errors.push(...envResult.errors);
    }
  }
  
  // Processing time validation
  if (typeof metadata.processingTime !== 'number') {
    errors.push('Processing time must be a number');
  } else {
    if (metadata.processingTime < 0) {
      errors.push('Processing time cannot be negative');
    } else if (metadata.processingTime > 300000) { // 5 minutes
      warnings.push('Processing time is unusually long (over 5 minutes)');
    }
  }
  
  // Request ID validation
  if (!metadata.requestId || typeof metadata.requestId !== 'string') {
    errors.push('Request ID must be a non-empty string');
  }
  
  // Timestamp validation
  if (!metadata.timestamp || typeof metadata.timestamp !== 'string') {
    errors.push('Timestamp must be a non-empty string');
  } else {
    try {
      const timestamp = new Date(metadata.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('Timestamp must be a valid date string');
      }
    } catch {
      errors.push('Timestamp must be a valid date string');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate realtime update
 */
export const validateRealtimeUpdateEnhanced = (update: any): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!update || typeof update !== 'object') {
    errors.push('Realtime update must be an object');
    return { isValid: false, errors, warnings };
  }
  
  // ID validation
  if (!update.id || typeof update.id !== 'string') {
    errors.push('Update ID must be a non-empty string');
  }
  
  // Timestamp validation
  if (!update.timestamp || typeof update.timestamp !== 'string') {
    errors.push('Timestamp must be a non-empty string');
  } else {
    try {
      const timestamp = new Date(update.timestamp);
      if (isNaN(timestamp.getTime())) {
        errors.push('Timestamp must be a valid date string');
      }
    } catch {
      errors.push('Timestamp must be a valid date string');
    }
  }
  
  // Step validation
  if (!update.step || typeof update.step !== 'string') {
    errors.push('Step must be a non-empty string');
  } else {
    const validSteps: ProcessingStep[] = [
      'validating', 'authenticating', 'fetching-case-data', 'processing-results', 'complete'
    ];
    if (!validSteps.includes(update.step as ProcessingStep)) {
      warnings.push(`Step '${update.step}' is not a recognized processing step`);
    }
  }
  
  // Message validation
  if (!update.message || typeof update.message !== 'string') {
    errors.push('Message must be a non-empty string');
  }
  
  // Level validation
  if (!update.level || typeof update.level !== 'string') {
    errors.push('Level must be a non-empty string');
  } else {
    const validLevels = ['info', 'warning', 'error', 'success'];
    if (!validLevels.includes(update.level)) {
      errors.push(`Level must be one of: ${validLevels.join(', ')}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate URL format
 */
export const validateUrl = (url: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!url || typeof url !== 'string') {
    errors.push('URL must be a non-empty string');
    return { isValid: false, errors, warnings };
  }
  
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push('URL must use HTTP or HTTPS protocol');
    }
    
    // Warn about HTTP in production-like environments
    if (urlObj.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(urlObj.hostname)) {
      warnings.push('HTTP URLs are not secure for production use');
    }
    
    // Check for localhost/development URLs
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(urlObj.hostname)) {
      warnings.push('URL appears to be a development/localhost URL');
    }
    
  } catch {
    errors.push('URL format is invalid');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validate JSON string
 */
export const validateJsonString = (jsonString: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!jsonString || typeof jsonString !== 'string') {
    errors.push('JSON must be a non-empty string');
    return { isValid: false, errors, warnings };
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    
    if (parsed === null) {
      warnings.push('JSON contains null value');
    } else if (typeof parsed !== 'object') {
      warnings.push('JSON does not contain an object');
    }
    
  } catch (error) {
    errors.push(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Enhanced ProcessingResult validation (wrapper for existing function)
 */
export const validateProcessingResult = (result: any): ValidationResult => {
  const validation = require('../types').validateProcessingResult(result);
  return {
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: []
  };
};

/**
 * Enhanced OAuthToken validation (wrapper for existing function)
 */
export const validateOAuthToken = (token: any): ValidationResult => {
  const validation = require('../types').validateOAuthToken(token);
  return {
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: []
  };
};

/**
 * Enhanced CaseDetails validation (wrapper for existing function)
 */
export const validateCaseDetails = (caseDetails: any): ValidationResult => {
  const validation = require('../types').validateCaseDetails(caseDetails);
  return {
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: []
  };
};