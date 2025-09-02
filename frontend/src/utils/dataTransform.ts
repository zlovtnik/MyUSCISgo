import type { 
  ProcessingResult, 
  OAuthToken, 
  CaseDetails, 
  ProcessingMetadata,
  RealtimeUpdate,
  ProcessingStep
} from '../types';
import { 
  validateProcessingResult, 
  validateOAuthToken, 
  validateCaseDetails,
  isProcessingMetadata,
  isRealtimeUpdate
} from '../types';

// Memoization cache for expensive transformations
const transformCache = new Map<string, any>();
const CACHE_SIZE_LIMIT = 100;

/**
 * Transform raw WASM output to ProcessingResult with proper type validation
 * Uses memoization to cache expensive transformations
 */
export const transformWASMOutput = (rawOutput: any): ProcessingResult => {
  if (!rawOutput || typeof rawOutput !== 'object') {
    throw new Error('Invalid WASM output: expected object');
  }

  // Create cache key from raw output
  const cacheKey = JSON.stringify(rawOutput);
  
  // Check cache first
  if (transformCache.has(cacheKey)) {
    return transformCache.get(cacheKey);
  }

  // Start with base fields that should always be present
  const baseResult: ProcessingResult = {
    baseURL: String(rawOutput.baseURL || ''),
    authMode: String(rawOutput.authMode || ''),
    tokenHint: String(rawOutput.tokenHint || ''),
    config: rawOutput.config && typeof rawOutput.config === 'object' ? rawOutput.config : {}
  };

  // Transform OAuth token if present
  if (rawOutput.oauthToken || rawOutput.oauth_token) {
    const tokenData = rawOutput.oauthToken || rawOutput.oauth_token;
    const transformedToken = transformOAuthToken(tokenData);
    if (transformedToken) {
      baseResult.oauthToken = transformedToken;
    }
  }

  // Transform case details if present
  if (rawOutput.caseDetails || rawOutput.case_details) {
    const caseData = rawOutput.caseDetails || rawOutput.case_details;
    const transformedCase = transformCaseDetails(caseData);
    if (transformedCase) {
      baseResult.caseDetails = transformedCase;
    }
  }

  // Transform processing metadata if present
  if (rawOutput.processingMetadata || rawOutput.processing_metadata || rawOutput.metadata) {
    const metadataData = rawOutput.processingMetadata || rawOutput.processing_metadata || rawOutput.metadata;
    const transformedMetadata = transformProcessingMetadata(metadataData);
    if (transformedMetadata) {
      baseResult.processingMetadata = transformedMetadata;
    }
  }

  // Validate the final result
  const validation = validateProcessingResult(baseResult);
  if (!validation.isValid) {
    console.warn('ProcessingResult validation warnings:', validation.errors);
  }

  // Cache the result (with size limit)
  if (transformCache.size >= CACHE_SIZE_LIMIT) {
    // Remove oldest entry
    const firstKey = transformCache.keys().next().value;
    if (firstKey) {
      transformCache.delete(firstKey);
    }
  }
  transformCache.set(cacheKey, baseResult);

  return baseResult;
};

/**
 * Transform raw OAuth token data to OAuthToken interface
 */
export const transformOAuthToken = (rawToken: any): OAuthToken | null => {
  if (!rawToken || typeof rawToken !== 'object') {
    return null;
  }

  try {
    // Handle different possible field names from WASM
    const token: OAuthToken = {
      accessToken: String(rawToken.accessToken || rawToken.access_token || rawToken.token || ''),
      tokenType: String(rawToken.tokenType || rawToken.token_type || 'Bearer'),
      expiresIn: Number(rawToken.expiresIn || rawToken.expires_in || 3600),
      expiresAt: String(rawToken.expiresAt || rawToken.expires_at || new Date(Date.now() + 3600000).toISOString()),
      scope: rawToken.scope ? String(rawToken.scope) : undefined
    };

    // Validate the transformed token
    const validation = validateOAuthToken(token);
    if (!validation.isValid) {
      console.warn('OAuth token validation failed:', validation.errors);
      return null;
    }

    return token;
  } catch (error) {
    console.error('Error transforming OAuth token:', error);
    return null;
  }
};

/**
 * Transform raw case details data to CaseDetails interface
 */
export const transformCaseDetails = (rawCase: any): CaseDetails | null => {
  if (!rawCase || typeof rawCase !== 'object') {
    return null;
  }

  try {
    // Handle different possible field names and formats from WASM
    const caseDetails: CaseDetails = {
      caseNumber: rawCase.caseNumber || rawCase.case_number || rawCase['Case Number'] || undefined,
      currentStatus: String(rawCase.currentStatus || rawCase.current_status || rawCase['Current Status'] || 'Unknown'),
      processingCenter: String(rawCase.processingCenter || rawCase.processing_center || rawCase['Processing Center'] || 'Unknown'),
      priorityDate: String(rawCase.priorityDate || rawCase.priority_date || rawCase['Priority Date'] || ''),
      caseType: String(rawCase.caseType || rawCase.case_type || rawCase['Case Type'] || 'Unknown'),
      approvalDate: rawCase.approvalDate || rawCase.approval_date || rawCase['Approval Date'] || undefined,
      lastUpdated: String(rawCase.lastUpdated || rawCase.last_updated || rawCase['Last Updated'] || new Date().toISOString()),
      verificationId: rawCase.verificationId || rawCase.verification_id || rawCase['Verification ID'] || undefined
    };

    // Validate the transformed case details
    const validation = validateCaseDetails(caseDetails);
    if (!validation.isValid) {
      console.warn('Case details validation failed:', validation.errors);
      return null;
    }

    return caseDetails;
  } catch (error) {
    console.error('Error transforming case details:', error);
    return null;
  }
};

/**
 * Transform raw processing metadata to ProcessingMetadata interface
 */
export const transformProcessingMetadata = (rawMetadata: any): ProcessingMetadata | null => {
  if (!rawMetadata || typeof rawMetadata !== 'object') {
    return null;
  }

  try {
    const metadata: ProcessingMetadata = {
      environment: String(rawMetadata.environment || 'development'),
      processingTime: Number(rawMetadata.processingTime || rawMetadata.processing_time || 0),
      requestId: String(rawMetadata.requestId || rawMetadata.request_id || Math.random().toString(36).substring(2, 11)),
      timestamp: String(rawMetadata.timestamp || new Date().toISOString())
    };

    // Basic validation
    if (!isProcessingMetadata(metadata)) {
      console.warn('Processing metadata validation failed');
      return null;
    }

    return metadata;
  } catch (error) {
    console.error('Error transforming processing metadata:', error);
    return null;
  }
};

/**
 * Transform raw realtime update data to RealtimeUpdate interface
 */
export const transformRealtimeUpdate = (rawUpdate: any): RealtimeUpdate | null => {
  if (!rawUpdate || typeof rawUpdate !== 'object') {
    return null;
  }

  try {
    const update: RealtimeUpdate = {
      id: String(rawUpdate.id || Math.random().toString(36).substring(2, 11)),
      timestamp: String(rawUpdate.timestamp || new Date().toISOString()),
      step: normalizeProcessingStep(rawUpdate.step || rawUpdate.stage || 'validating'),
      message: String(rawUpdate.message || rawUpdate.msg || ''),
      level: normalizeLogLevel(rawUpdate.level || rawUpdate.severity || 'info')
    };

    // Validate the transformed update
    if (!isRealtimeUpdate(update)) {
      console.warn('Realtime update validation failed');
      return null;
    }

    return update;
  } catch (error) {
    console.error('Error transforming realtime update:', error);
    return null;
  }
};

/**
 * Normalize processing step to valid ProcessingStep type
 */
export const normalizeProcessingStep = (step: string): ProcessingStep => {
  const normalizedStep = step.toLowerCase().replace(/[-_\s]/g, '-');
  
  switch (normalizedStep) {
    case 'validating':
    case 'validate':
    case 'validation':
      return 'validating';
    case 'authenticating':
    case 'authenticate':
    case 'auth':
    case 'authentication':
      return 'authenticating';
    case 'fetching-case-data':
    case 'fetch-case-data':
    case 'fetching':
    case 'fetch-case':
    case 'case-data':
    case 'getting-case':
      return 'fetching-case-data';
    case 'processing-results':
    case 'processing':
    case 'process-results':
    case 'results':
      return 'processing-results';
    case 'complete':
    case 'completed':
    case 'done':
    case 'finished':
      return 'complete';
    default:
      return 'validating';
  }
};

/**
 * Normalize log level to valid level type
 */
export const normalizeLogLevel = (level: string): 'info' | 'warning' | 'error' | 'success' => {
  const normalizedLevel = level.toLowerCase();
  
  switch (normalizedLevel) {
    case 'info':
    case 'information':
    case 'debug':
      return 'info';
    case 'warning':
    case 'warn':
    case 'caution':
      return 'warning';
    case 'error':
    case 'err':
    case 'failure':
    case 'fail':
      return 'error';
    case 'success':
    case 'ok':
    case 'complete':
    case 'done':
      return 'success';
    default:
      return 'info';
  }
};

/**
 * Safe JSON parsing with error handling
 */
export const safeJsonParse = (jsonString: string): any => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parsing error:', error);
    return null;
  }
};

/**
 * Deep clone object to prevent mutation issues
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned = {} as T;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  
  return cloned;
};

/**
 * Sanitize sensitive data for logging/display
 */
export const sanitizeForLogging = (obj: any): any => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = deepClone(obj);
  
  // Recursively sanitize sensitive fields
  const sanitizeObject = (target: any): any => {
    if (!target || typeof target !== 'object') {
      return target;
    }

    for (const key in target) {
      if (Object.hasOwn(target, key)) {
        const lowerKey = key.toLowerCase();
        
        // Mask sensitive fields
        if (lowerKey.includes('token') || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('key')) {
          if (typeof target[key] === 'string' && target[key].length > 0) {
            target[key] = `${target[key].substring(0, 4)}****${target[key].substring(target[key].length - 4)}`;
          }
        } else if (typeof target[key] === 'object') {
          target[key] = sanitizeObject(target[key]);
        }
      }
    }
    
    return target;
  };

  return sanitizeObject(sanitized);
};

/**
 * Clear the transformation cache to free memory
 */
export const clearTransformCache = (): void => {
  transformCache.clear();
};

/**
 * Get cache statistics for debugging
 */
export const getCacheStats = () => {
  return {
    size: transformCache.size,
    limit: CACHE_SIZE_LIMIT,
    keys: Array.from(transformCache.keys()).slice(0, 5) // First 5 keys for debugging
  };
};