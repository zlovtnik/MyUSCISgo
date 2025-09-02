import React, { useState, useEffect } from 'react';
import type { OAuthToken, Environment } from '../../types';

interface TokenStatusViewProps {
  oauthToken: OAuthToken;
  environment: Environment;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

const TokenStatusView: React.FC<TokenStatusViewProps> = ({ oauthToken, environment }) => {
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ 
    days: 0, 
    hours: 0, 
    minutes: 0, 
    seconds: 0, 
    isExpired: false 
  });

  // Calculate time remaining until token expiration
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date();
      const expirationDate = new Date(oauthToken.expiresAt);
      
      // Handle invalid dates
      if (isNaN(expirationDate.getTime())) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }
      
      const timeDiff = expirationDate.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setTimeRemaining({ days, hours, minutes, seconds, isExpired: false });
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [oauthToken.expiresAt]);

  // Mask the access token for security
  const maskToken = (token: string): string => {
    if (token.length <= 8) {
      return '***';
    }
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  };

  // Get token validity status
  const getValidityStatus = () => {
    if (timeRemaining.isExpired) {
      return {
        status: 'Expired',
        className: 'bg-red-100 text-red-800 border-red-200',
        icon: '❌'
      };
    }
    
    const totalMinutes = timeRemaining.days * 24 * 60 + timeRemaining.hours * 60 + timeRemaining.minutes;
    
    if (totalMinutes < 30) {
      return {
        status: 'Expiring Soon',
        className: 'bg-orange-100 text-orange-800 border-orange-200',
        icon: '⚠️'
      };
    }
    
    if (totalMinutes < 60) {
      return {
        status: 'Valid (Low)',
        className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '⏰'
      };
    }
    
    return {
      status: 'Valid',
      className: 'bg-green-100 text-green-800 border-green-200',
      icon: '✅'
    };
  };

  // Format expiration countdown
  const formatCountdown = () => {
    if (timeRemaining.isExpired) {
      return 'Token has expired';
    }

    const parts = [];
    if (timeRemaining.days > 0) parts.push(`${timeRemaining.days}d`);
    if (timeRemaining.hours > 0) parts.push(`${timeRemaining.hours}h`);
    if (timeRemaining.minutes > 0) parts.push(`${timeRemaining.minutes}m`);
    if (timeRemaining.seconds > 0 && timeRemaining.days === 0) parts.push(`${timeRemaining.seconds}s`);

    return parts.length > 0 ? parts.join(' ') : 'Less than 1 second';
  };

  // Get token type description
  const getTokenTypeDescription = (tokenType: string) => {
    switch (tokenType.toLowerCase()) {
      case 'bearer':
        return 'Bearer token for API authentication';
      case 'basic':
        return 'Basic authentication token';
      case 'oauth':
        return 'OAuth 2.0 access token';
      default:
        return `${tokenType} authentication token`;
    }
  };

  // Get scope description
  const getScopeDescription = (scope?: string) => {
    if (!scope) return 'No specific scope defined';
    
    const scopes = scope.split(' ');
    const descriptions: Record<string, string> = {
      'read': 'Read access to resources',
      'write': 'Write access to resources',
      'admin': 'Administrative privileges',
      'case:read': 'Read case information',
      'case:write': 'Modify case information',
      'profile': 'Access to user profile',
      'openid': 'OpenID Connect authentication'
    };

    return scopes.map(s => descriptions[s] || s).join(', ');
  };

  const validityInfo = getValidityStatus();

  return (
    <div 
      className="space-y-4 sm:space-y-6"
      role="region"
      aria-labelledby="token-status-heading"
    >
      {/* Token Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <h3 
          id="token-status-heading"
          className="text-lg font-semibold text-gray-900"
        >
          OAuth Token Status
        </h3>
        <div 
          className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${validityInfo.className}`}
          role="status"
          aria-label={`Token validity: ${validityInfo.status}`}
        >
          <span className="mr-1 sm:mr-2" aria-hidden="true">{validityInfo.icon}</span>
          <span className="truncate">{validityInfo.status}</span>
        </div>
      </div>

      {/* Token Information Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Token Details */}
        <div className="space-y-4">
          <div>
            <label 
              className="block text-sm font-medium text-gray-700 mb-1"
              id="access-token-label"
            >
              Access Token
            </label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <code 
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm font-mono break-all"
                aria-labelledby="access-token-label"
                aria-describedby="token-security-note"
              >
                {maskToken(oauthToken.accessToken)}
              </code>
              <button
                onClick={() => navigator.clipboard?.writeText(oauthToken.accessToken)}
                className="px-3 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                aria-label="Copy full access token to clipboard"
                type="button"
              >
                <span aria-hidden="true">📋</span>
                <span className="ml-1 hidden sm:inline">Copy</span>
              </button>
            </div>
            <p 
              id="token-security-note"
              className="text-xs text-gray-500 mt-1"
            >
              Token is masked for security. Click copy to get full token.
            </p>
          </div>

          <div>
            <label 
              className="block text-sm font-medium text-gray-700 mb-1"
              id="token-type-label"
            >
              Token Type
            </label>
            <div 
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
              role="text"
              aria-labelledby="token-type-label"
            >
              <div className="text-sm font-medium text-gray-900">{oauthToken.tokenType}</div>
              <div className="text-xs text-gray-600">{getTokenTypeDescription(oauthToken.tokenType)}</div>
            </div>
          </div>

          <div>
            <label 
              className="block text-sm font-medium text-gray-700 mb-1"
              id="token-scope-label"
            >
              Scope
            </label>
            <div 
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
              role="text"
              aria-labelledby="token-scope-label"
            >
              <div className="text-sm font-medium text-gray-900">
                {oauthToken.scope || 'Not specified'}
              </div>
              <div className="text-xs text-gray-600">{getScopeDescription(oauthToken.scope)}</div>
            </div>
          </div>
        </div>

        {/* Expiration Information */}
        <div className="space-y-4">
          <div>
            <label 
              className="block text-sm font-medium text-gray-700 mb-1"
              id="expiration-time-label"
            >
              Expiration Time
            </label>
            <div 
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
              role="text"
              aria-labelledby="expiration-time-label"
            >
              <div className="text-sm font-medium text-gray-900">
                <time dateTime={oauthToken.expiresAt}>
                  {(() => {
                    const date = new Date(oauthToken.expiresAt);
                    return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleString();
                  })()}
                </time>
              </div>
              <div className="text-xs text-gray-600 break-all">
                {(() => {
                  const date = new Date(oauthToken.expiresAt);
                  return isNaN(date.getTime()) ? oauthToken.expiresAt : date.toISOString();
                })()}
              </div>
            </div>
          </div>

          <div>
            <label 
              className="block text-sm font-medium text-gray-700 mb-1"
              id="time-remaining-label"
            >
              Time Remaining
            </label>
            <div 
              className={`px-3 py-2 border rounded-md ${
                timeRemaining.isExpired 
                  ? 'bg-red-50 border-red-200' 
                  : 'bg-gray-50 border-gray-200'
              }`}
              role="timer"
              aria-labelledby="time-remaining-label"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className={`text-sm font-medium ${
                timeRemaining.isExpired ? 'text-red-900' : 'text-gray-900'
              }`}>
                {formatCountdown()}
              </div>
              <div className="text-xs text-gray-600">
                {timeRemaining.isExpired ? 'Token needs to be refreshed' : 'Until token expires'}
              </div>
            </div>
          </div>

          <div>
            <label 
              className="block text-sm font-medium text-gray-700 mb-1"
              id="expires-in-label"
            >
              Expires In (seconds)
            </label>
            <div 
              className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md"
              role="text"
              aria-labelledby="expires-in-label"
            >
              <div className="text-sm font-medium text-gray-900">
                {oauthToken.expiresIn.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">
                Original expiration duration from token issuance
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Environment-specific Information */}
      {environment === 'development' && (
        <div 
          className="mt-4 sm:mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md"
          role="region"
          aria-labelledby="debug-info-heading"
        >
          <h4 
            id="debug-info-heading"
            className="text-sm font-medium text-blue-900 mb-2"
          >
            Development Mode Debug Info
          </h4>
          <div className="text-xs text-blue-800 space-y-1">
            <div>Full token length: {oauthToken.accessToken.length} characters</div>
            <div>Token starts with: {oauthToken.accessToken.substring(0, 10)}...</div>
            <div>
              Issued at: 
              <time dateTime={new Date(Date.now() - (oauthToken.expiresIn * 1000)).toISOString()}>
                {new Date(Date.now() - (oauthToken.expiresIn * 1000)).toISOString()}
              </time>
            </div>
          </div>
        </div>
      )}

      {/* Token Actions */}
      <div 
        className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 pt-4 border-t border-gray-200"
        role="group"
        aria-label="Token actions"
      >
        <button
          onClick={() => navigator.clipboard?.writeText(JSON.stringify(oauthToken, null, 2))}
          className="px-4 py-2 text-sm bg-gray-50 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          type="button"
          aria-label="Copy complete token information as JSON to clipboard"
        >
          Copy Token JSON
        </button>
        
        {timeRemaining.isExpired && (
          <button
            className="px-4 py-2 text-sm bg-orange-50 text-orange-700 border border-orange-200 rounded-md hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition-colors"
            onClick={() => window.location.reload()}
            type="button"
            aria-label="Refresh page to re-authenticate with new token"
          >
            Refresh Page to Re-authenticate
          </button>
        )}
        
        <button
          onClick={() => {
            const tokenInfo = {
              type: oauthToken.tokenType,
              scope: oauthToken.scope,
              expiresAt: oauthToken.expiresAt,
              isExpired: timeRemaining.isExpired,
              timeRemaining: formatCountdown()
            };
            navigator.clipboard?.writeText(JSON.stringify(tokenInfo, null, 2));
          }}
          className="px-4 py-2 text-sm bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          type="button"
          aria-label="Copy token summary information to clipboard"
        >
          Copy Token Summary
        </button>
      </div>
    </div>
  );
};

export default TokenStatusView;