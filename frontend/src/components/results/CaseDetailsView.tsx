import React from 'react';
import type { CaseDetails, Environment } from '../../types';

interface CaseDetailsViewProps {
  caseDetails: CaseDetails;
  environment: Environment;
}

interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getStatusInfo = (status: string): { color: string; icon: string; description: string } => {
    const normalizedStatus = status.toLowerCase();
    
    if (normalizedStatus.includes('approved') || normalizedStatus.includes('complete')) {
      return {
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '✓',
        description: 'Approved status'
      };
    }
    
    if (normalizedStatus.includes('pending') || normalizedStatus.includes('review')) {
      return {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '⏳',
        description: 'Pending status'
      };
    }
    
    if (normalizedStatus.includes('denied') || normalizedStatus.includes('rejected')) {
      return {
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '✗',
        description: 'Denied status'
      };
    }
    
    if (normalizedStatus.includes('processing') || normalizedStatus.includes('progress') || normalizedStatus.includes('actively')) {
      return {
        color: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: '⚙️',
        description: 'Processing status'
      };
    }
    
    // Default status color
    return {
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      icon: '📋',
      description: 'Status information'
    };
  };

  const statusInfo = getStatusInfo(status);

  return (
    <span 
      className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${statusInfo.color}`}
      role="status"
      aria-label={`${statusInfo.description}: ${status}`}
    >
      <span className="mr-1 sm:mr-2" aria-hidden="true">{statusInfo.icon}</span>
      <span className="truncate max-w-[120px] sm:max-w-none">{status}</span>
    </span>
  );
};

const formatRelativeTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original string if invalid date
    }
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      if (diffInHours === 0) {
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes} minutes ago`;
      }
      return diffInHours === 1 ? '1 hour ago' : `${diffInHours} hours ago`;
    }
    
    if (diffInDays === 1) {
      return 'Yesterday';
    }
    
    if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    }
    
    if (diffInDays < 30) {
      const weeks = Math.floor(diffInDays / 7);
      return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
    }
    
    if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    
    const years = Math.floor(diffInDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  } catch (error) {
    return dateString; // Fallback to original string if parsing fails
  }
};

const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Return original string if invalid date
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString; // Fallback to original string if parsing fails
  }
};

export const CaseDetailsView: React.FC<CaseDetailsViewProps> = ({ 
  caseDetails, 
  environment 
}) => {
  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6"
      role="region"
      aria-labelledby="case-details-heading"
    >
      <div className="space-y-4 sm:space-y-6">
        {/* Header with Case Number and Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h3 
              id="case-details-heading"
              className="text-lg font-semibold text-gray-900"
            >
              Case Details
            </h3>
            {caseDetails.caseNumber && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="sr-only">Case Number: </span>
                Case Number: {caseDetails.caseNumber}
              </p>
            )}
          </div>
          <div aria-label={`Case status: ${caseDetails.currentStatus}`}>
            <StatusBadge status={caseDetails.currentStatus} />
          </div>
        </div>

        {/* Case Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Processing Center */}
          <div className="space-y-2">
            <label 
              className="text-sm font-medium text-gray-700"
              id="processing-center-label"
            >
              Processing Center
            </label>
            <div 
              className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2"
              role="text"
              aria-labelledby="processing-center-label"
            >
              {caseDetails.processingCenter}
            </div>
          </div>

          {/* Case Type */}
          <div className="space-y-2">
            <label 
              className="text-sm font-medium text-gray-700"
              id="case-type-label"
            >
              Case Type
            </label>
            <div 
              className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2"
              role="text"
              aria-labelledby="case-type-label"
            >
              {caseDetails.caseType}
            </div>
          </div>

          {/* Priority Date */}
          <div className="space-y-2">
            <label 
              className="text-sm font-medium text-gray-700"
              id="priority-date-label"
            >
              Priority Date
            </label>
            <div 
              className="text-sm text-gray-900 bg-gray-50 rounded-md px-3 py-2"
              role="text"
              aria-labelledby="priority-date-label"
              aria-describedby="priority-date-relative"
            >
              <p>{formatDate(caseDetails.priorityDate)}</p>
              <p 
                id="priority-date-relative"
                className="text-xs text-gray-500 mt-1"
                aria-label={`Priority date was ${formatRelativeTime(caseDetails.priorityDate)}`}
              >
                {formatRelativeTime(caseDetails.priorityDate)}
              </p>
            </div>
          </div>

          {/* Approval Date (if available) */}
          {caseDetails.approvalDate && (
            <div className="space-y-2">
              <label 
                className="text-sm font-medium text-gray-700"
                id="approval-date-label"
              >
                Approval Date
              </label>
              <div 
                className="text-sm text-gray-900 bg-green-50 rounded-md px-3 py-2 border border-green-200"
                role="text"
                aria-labelledby="approval-date-label"
                aria-describedby="approval-date-relative"
              >
                <p className="font-medium text-green-800">
                  {formatDate(caseDetails.approvalDate)}
                </p>
                <p 
                  id="approval-date-relative"
                  className="text-xs text-green-600 mt-1"
                  aria-label={`Approved ${formatRelativeTime(caseDetails.approvalDate)}`}
                >
                  {formatRelativeTime(caseDetails.approvalDate)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Last Updated and Verification */}
        <div className="border-t border-gray-200 pt-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium">Last Updated:</span>{' '}
              <time 
                dateTime={caseDetails.lastUpdated}
                aria-label={`Last updated on ${formatDate(caseDetails.lastUpdated)}, which was ${formatRelativeTime(caseDetails.lastUpdated)}`}
              >
                {formatDate(caseDetails.lastUpdated)} ({formatRelativeTime(caseDetails.lastUpdated)})
              </time>
            </div>
            
            {caseDetails.verificationId && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Verification ID:</span>{' '}
                <code 
                  className="bg-gray-100 px-2 py-1 rounded text-xs break-all"
                  aria-label={`Verification ID: ${caseDetails.verificationId}`}
                >
                  {caseDetails.verificationId}
                </code>
              </div>
            )}
          </div>
          
          {/* Environment indicator for development */}
          {environment === 'development' && (
            <div 
              className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 border border-blue-200"
              role="note"
              aria-label="Development mode notice"
            >
              <span className="font-medium">Development Mode:</span> Additional debug information available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseDetailsView;