import type { Environment } from '../types';

/**
 * Format a date string to a human-readable format
 */
export const formatDate = (dateString: string, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };
    
    return date.toLocaleDateString('en-US', defaultOptions);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
};

/**
 * Format a date string to include time
 */
export const formatDateTime = (dateString: string, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    };
    
    return date.toLocaleDateString('en-US', defaultOptions);
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return 'Invalid Date';
  }
};

/**
 * Format a date to show relative time (e.g., "2 days ago", "in 3 hours")
 */
export const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    // Future dates
    if (diffInSeconds < 0) {
      const absDiff = Math.abs(diffInSeconds);
      if (absDiff < 60) return 'in a few seconds';
      if (absDiff < 3600) return `in ${Math.floor(absDiff / 60)} minutes`;
      if (absDiff < 86400) return `in ${Math.floor(absDiff / 3600)} hours`;
      if (absDiff < 2592000) return `in ${Math.floor(absDiff / 86400)} days`;
      return formatDate(dateString);
    }
    
    // Past dates
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    // For dates older than 30 days, show the actual date
    return formatDate(dateString);
  } catch (error) {
    console.error('Error formatting relative time:', error);
    return 'Invalid Date';
  }
};

/**
 * Format processing time in milliseconds to human-readable format
 */
export const formatProcessingTime = (timeMs: number): string => {
  if (typeof timeMs !== 'number' || timeMs < 0 || isNaN(timeMs)) {
    return 'N/A';
  }
  
  if (timeMs < 1000) {
    return `${timeMs}ms`;
  }
  
  const seconds = timeMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${minutes.toFixed(1)}m`;
  }
  
  const hours = minutes / 60;
  return `${hours.toFixed(1)}h`;
};

/**
 * Format token expiration countdown
 */
export const formatTokenExpiration = (expiresAt: string): {
  timeLeft: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
} => {
  if (!expiresAt) {
    return {
      timeLeft: 'Unknown',
      isExpired: false,
      isExpiringSoon: false
    };
  }
  
  try {
    const expirationDate = new Date(expiresAt);
    if (isNaN(expirationDate.getTime())) {
      return {
        timeLeft: 'Invalid Date',
        isExpired: false,
        isExpiringSoon: false
      };
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((expirationDate.getTime() - now.getTime()) / 1000);
    
    if (diffInSeconds <= 0) {
      return {
        timeLeft: 'Expired',
        isExpired: true,
        isExpiringSoon: false
      };
    }
    
    const isExpiringSoon = diffInSeconds < 300; // Less than 5 minutes
    
    if (diffInSeconds < 60) {
      return {
        timeLeft: `${diffInSeconds}s`,
        isExpired: false,
        isExpiringSoon
      };
    }
    
    const minutes = Math.floor(diffInSeconds / 60);
    if (minutes < 60) {
      return {
        timeLeft: `${minutes}m`,
        isExpired: false,
        isExpiringSoon
      };
    }
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return {
        timeLeft: `${hours}h ${minutes % 60}m`,
        isExpired: false,
        isExpiringSoon: false
      };
    }
    
    const days = Math.floor(hours / 24);
    return {
      timeLeft: `${days}d ${hours % 24}h`,
      isExpired: false,
      isExpiringSoon: false
    };
  } catch (error) {
    console.error('Error formatting token expiration:', error);
    return {
      timeLeft: 'Error',
      isExpired: false,
      isExpiringSoon: false
    };
  }
};

/**
 * Format case status with appropriate styling information
 */
export const formatCaseStatus = (status: string): {
  formatted: string;
  color: string;
  bgColor: string;
  borderColor: string;
} => {
  if (!status) {
    return {
      formatted: 'Unknown',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-200'
    };
  }
  
  const normalizedStatus = status.toLowerCase().trim();
  
  // Map common status values to formatted versions with colors
  const statusMap: Record<string, {
    formatted: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }> = {
    'approved': {
      formatted: 'Approved',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      borderColor: 'border-green-200'
    },
    'pending': {
      formatted: 'Pending',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-200'
    },
    'in review': {
      formatted: 'In Review',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-200'
    },
    'under review': {
      formatted: 'Under Review',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-200'
    },
    'denied': {
      formatted: 'Denied',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200'
    },
    'rejected': {
      formatted: 'Rejected',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200'
    },
    'withdrawn': {
      formatted: 'Withdrawn',
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      borderColor: 'border-gray-200'
    },
    'terminated': {
      formatted: 'Terminated',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200'
    },
    'ready for interview': {
      formatted: 'Ready for Interview',
      color: 'text-purple-700',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-200'
    },
    'interview scheduled': {
      formatted: 'Interview Scheduled',
      color: 'text-purple-700',
      bgColor: 'bg-purple-100',
      borderColor: 'border-purple-200'
    }
  };
  
  const statusInfo = statusMap[normalizedStatus];
  if (statusInfo) {
    return statusInfo;
  }
  
  // Default formatting for unknown statuses
  return {
    formatted: status.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' '),
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-200'
  };
};

/**
 * Format environment name with appropriate styling
 */
export const formatEnvironment = (environment: Environment): {
  formatted: string;
  color: string;
  bgColor: string;
  borderColor: string;
} => {
  const envMap: Record<Environment, {
    formatted: string;
    color: string;
    bgColor: string;
    borderColor: string;
  }> = {
    development: {
      formatted: 'Development',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      borderColor: 'border-blue-200'
    },
    staging: {
      formatted: 'Staging',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      borderColor: 'border-yellow-200'
    },
    production: {
      formatted: 'Production',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      borderColor: 'border-red-200'
    }
  };
  
  return envMap[environment] || envMap.development;
};

/**
 * Format file size in bytes to human-readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (typeof bytes !== 'number' || bytes < 0 || isNaN(bytes)) {
    return 'N/A';
  }
  
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
};

/**
 * Format percentage with proper decimal places
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  if (typeof value !== 'number' || isNaN(value)) {
    return 'N/A';
  }
  
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format JSON with proper indentation and syntax highlighting classes
 */
export const formatJsonForDisplay = (obj: any, indent: number = 2): string => {
  try {
    return JSON.stringify(obj, null, indent);
  } catch (error) {
    console.error('Error formatting JSON:', error);
    return 'Invalid JSON';
  }
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  if (maxLength <= 3) {
    return text.substring(0, maxLength);
  }
  
  return `${text.substring(0, maxLength - 3)}...`;
};

/**
 * Format case number with proper spacing and formatting
 */
export const formatCaseNumber = (caseNumber: string): string => {
  if (!caseNumber || typeof caseNumber !== 'string') {
    return 'N/A';
  }
  
  // Remove any existing spaces or special characters
  const cleaned = caseNumber.replace(/[^a-zA-Z0-9]/g, '');
  
  // Common USCIS case number formats
  // Format: ABC1234567890 -> ABC 123 456 7890
  if (cleaned.length >= 10) {
    const prefix = cleaned.substring(0, 3);
    const remaining = cleaned.substring(3);
    
    // For USCIS format, group as: ABC 123 456 7890 (3-3-4 pattern)
    if (remaining.length === 10) {
      return `${prefix} ${remaining.substring(0, 3)} ${remaining.substring(3, 6)} ${remaining.substring(6)}`;
    }
    
    // Fallback: group remaining digits in sets of 3
    const groups = [];
    for (let i = 0; i < remaining.length; i += 3) {
      groups.push(remaining.substring(i, i + 3));
    }
    
    return `${prefix} ${groups.join(' ')}`;
  }
  
  return caseNumber;
};