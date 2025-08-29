export interface Credentials {
  clientId: string;
  clientSecret: string;
  environment: Environment;
}

export interface ProcessingResult {
  baseURL: string;
  authMode: string;
  tokenHint: string;
  config: Record<string, string>;
  // Enhanced fields from WASM
  oauthToken?: OAuthToken;
  caseDetails?: CaseDetails;
  processingMetadata?: ProcessingMetadata;
}

export interface WASMResponse {
  success: boolean;
  result?: ProcessingResult;
  error?: string;
}

export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  value: Environment;
  label: string;
  description: string;
  color: string;
}

export const ENVIRONMENTS: EnvironmentConfig[] = [
  {
    value: 'development',
    label: 'Development',
    description: 'Local development environment with debug features enabled',
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    value: 'staging',
    label: 'Staging',
    description: 'Testing environment with production-like settings',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  },
  {
    value: 'production',
    label: 'Production',
    description: 'Live production environment with full security',
    color: 'bg-red-100 text-red-800 border-red-200'
  }
];

export interface FormErrors {
  clientId?: string;
  clientSecret?: string;
  environment?: string;
  general?: string;
}

export interface TokenCertificationResult {
  isValid: boolean;
  caseStatus: string;
  lastUpdated: string; // ISO 8601 format
  caseDetails: Record<string, string>;
  verificationId: string; // Always generated, present on both success and failure
}

export interface TokenCertificationData {
  readonly token: string;
  readonly caseNumber: string;
  readonly environment: Exclude<Environment, 'staging'>; // Note: staging not supported for certification flows
}

export interface TokenCertificationResponse {
  success: boolean;
  result?: TokenCertificationResult;
  error?: string;
}

// New interfaces for enhanced WASM integration

export interface OAuthToken {
  accessToken: string; // Will be masked in UI
  tokenType: string;
  expiresIn: number;
  expiresAt: string; // RFC3339 format
  scope?: string;
}

export interface CaseDetails {
  caseNumber?: string;
  currentStatus: string;
  processingCenter: string;
  priorityDate: string;
  caseType: string;
  approvalDate?: string;
  lastUpdated: string;
  verificationId?: string;
}

export interface ProcessingMetadata {
  environment: string;
  processingTime: number;
  requestId: string;
  timestamp: string;
}

// Processing step types for progress indication
export type ProcessingStep = 
  | 'validating'
  | 'authenticating' 
  | 'fetching-case-data'
  | 'processing-results'
  | 'complete';

export interface RealtimeUpdate {
  id: string;
  timestamp: string;
  step: ProcessingStep;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
}

// Result tab types for tabbed interface
export type ResultTab = 'case-details' | 'token-status' | 'configuration' | 'raw-data';

// Type guards for runtime type checking
export const isOAuthToken = (obj: any): obj is OAuthToken => {
  return !!(obj && 
    typeof obj.accessToken === 'string' &&
    typeof obj.tokenType === 'string' &&
    typeof obj.expiresIn === 'number' &&
    typeof obj.expiresAt === 'string');
};

export const isCaseDetails = (obj: any): obj is CaseDetails => {
  return !!(obj &&
    typeof obj.currentStatus === 'string' &&
    typeof obj.processingCenter === 'string' &&
    typeof obj.priorityDate === 'string' &&
    typeof obj.caseType === 'string' &&
    typeof obj.lastUpdated === 'string');
};

export const isProcessingMetadata = (obj: any): obj is ProcessingMetadata => {
  return !!(obj &&
    typeof obj.environment === 'string' &&
    typeof obj.processingTime === 'number' &&
    typeof obj.requestId === 'string' &&
    typeof obj.timestamp === 'string');
};

export const isProcessingResult = (obj: any): obj is ProcessingResult => {
  return !!(obj &&
    typeof obj.baseURL === 'string' &&
    typeof obj.authMode === 'string' &&
    typeof obj.tokenHint === 'string' &&
    typeof obj.config === 'object' &&
    obj.config !== null);
};

export const isRealtimeUpdate = (obj: any): obj is RealtimeUpdate => {
  return !!(obj &&
    typeof obj.id === 'string' &&
    typeof obj.timestamp === 'string' &&
    typeof obj.step === 'string' &&
    typeof obj.message === 'string' &&
    ['info', 'warning', 'error', 'success'].includes(obj.level));
};

// Validation utilities for runtime type checking
export const validateProcessingResult = (obj: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!obj) {
    errors.push('ProcessingResult is null or undefined');
    return { isValid: false, errors };
  }

  if (typeof obj.baseURL !== 'string') {
    errors.push('baseURL must be a string');
  }
  
  if (typeof obj.authMode !== 'string') {
    errors.push('authMode must be a string');
  }
  
  if (typeof obj.tokenHint !== 'string') {
    errors.push('tokenHint must be a string');
  }
  
  if (!obj.config || typeof obj.config !== 'object') {
    errors.push('config must be an object');
  }

  // Validate optional fields if present
  if (obj.oauthToken && !isOAuthToken(obj.oauthToken)) {
    errors.push('oauthToken is invalid');
  }
  
  if (obj.caseDetails && !isCaseDetails(obj.caseDetails)) {
    errors.push('caseDetails is invalid');
  }
  
  if (obj.processingMetadata && !isProcessingMetadata(obj.processingMetadata)) {
    errors.push('processingMetadata is invalid');
  }

  return { isValid: errors.length === 0, errors };
};

export const validateOAuthToken = (obj: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!obj) {
    errors.push('OAuthToken is null or undefined');
    return { isValid: false, errors };
  }

  if (typeof obj.accessToken !== 'string' || obj.accessToken.length === 0) {
    errors.push('accessToken must be a non-empty string');
  }
  
  if (typeof obj.tokenType !== 'string' || obj.tokenType.length === 0) {
    errors.push('tokenType must be a non-empty string');
  }
  
  if (typeof obj.expiresIn !== 'number' || obj.expiresIn <= 0) {
    errors.push('expiresIn must be a positive number');
  }
  
  if (typeof obj.expiresAt !== 'string' || obj.expiresAt.length === 0) {
    errors.push('expiresAt must be a non-empty string');
  }

  // Validate RFC3339 format for expiresAt
  if (obj.expiresAt && typeof obj.expiresAt === 'string') {
    try {
      const date = new Date(obj.expiresAt);
      if (isNaN(date.getTime())) {
        errors.push('expiresAt must be a valid RFC3339 date string');
      }
    } catch {
      errors.push('expiresAt must be a valid RFC3339 date string');
    }
  }

  return { isValid: errors.length === 0, errors };
};

export const validateCaseDetails = (obj: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!obj) {
    errors.push('CaseDetails is null or undefined');
    return { isValid: false, errors };
  }

  if (typeof obj.currentStatus !== 'string' || obj.currentStatus.length === 0) {
    errors.push('currentStatus must be a non-empty string');
  }
  
  if (typeof obj.processingCenter !== 'string' || obj.processingCenter.length === 0) {
    errors.push('processingCenter must be a non-empty string');
  }
  
  if (typeof obj.priorityDate !== 'string' || obj.priorityDate.length === 0) {
    errors.push('priorityDate must be a non-empty string');
  }
  
  if (typeof obj.caseType !== 'string' || obj.caseType.length === 0) {
    errors.push('caseType must be a non-empty string');
  }
  
  if (typeof obj.lastUpdated !== 'string' || obj.lastUpdated.length === 0) {
    errors.push('lastUpdated must be a non-empty string');
  }

  // Validate optional fields if present
  if (obj.caseNumber && typeof obj.caseNumber !== 'string') {
    errors.push('caseNumber must be a string if provided');
  }
  
  if (obj.approvalDate && typeof obj.approvalDate !== 'string') {
    errors.push('approvalDate must be a string if provided');
  }
  
  if (obj.verificationId && typeof obj.verificationId !== 'string') {
    errors.push('verificationId must be a string if provided');
  }

  return { isValid: errors.length === 0, errors };
};
