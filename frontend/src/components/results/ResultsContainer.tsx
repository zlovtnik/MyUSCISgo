import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import type { ProcessingResult, Environment, ResultTab } from '../../types';
import { cn } from '../../utils';
import { LoadingSpinner } from '../LoadingSpinner';
import { animations, presets, getStaggerDelay } from '../../utils/animations';

// Lazy load heavy components for better performance
const CaseDetailsView = lazy(() => import('./CaseDetailsView'));
const TokenStatusView = lazy(() => import('./TokenStatusView'));
const LazyJsonViewer = lazy(() => import('../LazyJsonViewer'));

interface ResultsContainerProps {
  result: ProcessingResult;
  environment: Environment;
  onReset: () => void;
}

interface TabConfig {
  id: ResultTab;
  label: string;
  icon: string;
  description: string;
  isAvailable: (result: ProcessingResult) => boolean;
}

const TAB_CONFIGS: TabConfig[] = [
  {
    id: 'case-details',
    label: 'Case Details',
    icon: '📋',
    description: 'Comprehensive case information and status',
    isAvailable: (result) => !!result.caseDetails
  },
  {
    id: 'token-status',
    label: 'Token Status',
    icon: '🔐',
    description: 'OAuth token information and expiration',
    isAvailable: (result) => !!result.oauthToken
  },
  {
    id: 'configuration',
    label: 'Configuration',
    icon: '⚙️',
    description: 'API endpoints and environment settings',
    isAvailable: () => true // Always available
  },
  {
    id: 'raw-data',
    label: 'Raw Data',
    icon: '📄',
    description: 'Complete JSON response data',
    isAvailable: () => true // Always available
  }
];

const STORAGE_KEY = 'results-container-active-tab';

export const ResultsContainer: React.FC<ResultsContainerProps> = ({
  result,
  environment,
  onReset
}) => {
  // Memoize available tabs calculation
  const availableTabs = useMemo(() => 
    TAB_CONFIGS.filter(tab => tab.isAvailable(result)), 
    [result]
  );
  
  // Initialize active tab from localStorage or first available tab
  const [activeTab, setActiveTab] = useState<ResultTab>(() => {
    const savedTab = localStorage.getItem(STORAGE_KEY) as ResultTab;
    if (savedTab && availableTabs.some(tab => tab.id === savedTab)) {
      return savedTab;
    }
    return availableTabs[0]?.id || 'configuration';
  });

  // Persist tab selection to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  // Ensure active tab is available when result changes
  useEffect(() => {
    if (!availableTabs.some(tab => tab.id === activeTab)) {
      setActiveTab(availableTabs[0]?.id || 'configuration');
    }
  }, [result, activeTab, availableTabs]);

  // Memoized keyboard navigation for tabs
  const handleKeyDown = useCallback((event: React.KeyboardEvent, tabId: ResultTab) => {
    const currentIndex = availableTabs.findIndex(tab => tab.id === tabId);
    let newIndex = currentIndex;

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : availableTabs.length - 1;
        break;
      case 'ArrowRight':
        event.preventDefault();
        newIndex = currentIndex < availableTabs.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        newIndex = availableTabs.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        setActiveTab(tabId);
        return;
      default:
        return;
    }

    const newTab = availableTabs[newIndex];
    if (newTab) {
      setActiveTab(newTab.id);
      // Focus the new tab button
      const tabButton = document.getElementById(`tab-${newTab.id}`);
      tabButton?.focus();
    }
  }, [availableTabs]);

  // Memoized JSON formatting to prevent recalculation
  const formattedJSON = useMemo(() => {
    try {
      return JSON.stringify(result, null, 2);
    } catch (error) {
      console.error('Error formatting JSON:', error);
      return 'Error formatting JSON data';
    }
  }, [result]);

  // Memoized copy function
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'case-details':
        if (!result.caseDetails) {
          return (
            <div className="text-center py-8 text-gray-500">
              <p>No case details available in this response.</p>
            </div>
          );
        }
        return (
          <Suspense fallback={<LoadingSpinner variant="skeleton" skeletonType="card" message="Loading case details..." />}>
            <CaseDetailsView 
              caseDetails={result.caseDetails} 
              environment={environment} 
            />
          </Suspense>
        );

      case 'token-status':
        if (!result.oauthToken) {
          return (
            <div className="text-center py-8 text-gray-500">
              <p>No OAuth token information available in this response.</p>
            </div>
          );
        }
        return (
          <Suspense fallback={<LoadingSpinner variant="skeleton" skeletonType="card" message="Loading token status..." />}>
            <TokenStatusView 
              oauthToken={result.oauthToken} 
              environment={environment} 
            />
          </Suspense>
        );

      case 'configuration':
        return (
          <div className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 
                  className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide"
                  id="base-url-heading"
                >
                  Base URL
                </h4>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <p 
                    className="text-sm sm:text-lg font-mono text-blue-600 break-all flex-1"
                    aria-labelledby="base-url-heading"
                  >
                    {result.baseURL}
                  </p>
                  <button
                    onClick={() => copyToClipboard(result.baseURL)}
                    className="px-2 py-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors self-start sm:self-center"
                    aria-label="Copy base URL to clipboard"
                    type="button"
                  >
                    <span aria-hidden="true">📋</span>
                    <span className="ml-1 hidden sm:inline">Copy</span>
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 
                  className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide"
                  id="auth-mode-heading"
                >
                  Auth Mode
                </h4>
                <p 
                  className="text-sm sm:text-lg font-mono text-green-600"
                  aria-labelledby="auth-mode-heading"
                >
                  {result.authMode}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 
                className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide"
                id="token-hint-heading"
              >
                Token Hint
              </h4>
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <div 
                  className="bg-white border rounded p-3 font-mono text-sm text-gray-800 break-all flex-1"
                  aria-labelledby="token-hint-heading"
                >
                  {result.tokenHint}
                </div>
                <button
                  onClick={() => copyToClipboard(result.tokenHint)}
                  className="px-2 py-1 text-xs bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors self-start"
                  aria-label="Copy token hint to clipboard"
                  type="button"
                >
                  <span aria-hidden="true">📋</span>
                  <span className="ml-1 hidden sm:inline">Copy</span>
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 
                className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide"
                id="config-params-heading"
              >
                Configuration Parameters
              </h4>
              <div 
                className="grid grid-cols-1 lg:grid-cols-2 gap-3"
                role="list"
                aria-labelledby="config-params-heading"
              >
                {Object.entries(result.config).map(([key, value]) => (
                  <div 
                    key={key} 
                    className="bg-white border rounded p-3"
                    role="listitem"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div 
                        className="text-xs font-medium text-gray-500 uppercase tracking-wide"
                        id={`config-${key}-label`}
                      >
                        {key}
                      </div>
                      <button
                        onClick={() => copyToClipboard(String(value))}
                        className="text-xs text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors rounded p-1"
                        aria-label={`Copy ${key} value to clipboard`}
                        type="button"
                      >
                        📋
                      </button>
                    </div>
                    <div 
                      className="font-mono text-sm text-gray-900 break-all"
                      aria-labelledby={`config-${key}-label`}
                    >
                      {String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Processing Metadata if available */}
            {result.processingMetadata && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
                  Processing Metadata
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-white border rounded p-3">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Environment
                    </div>
                    <div className="font-mono text-sm text-gray-900">
                      {result.processingMetadata.environment}
                    </div>
                  </div>
                  <div className="bg-white border rounded p-3">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Processing Time
                    </div>
                    <div className="font-mono text-sm text-gray-900">
                      {result.processingMetadata.processingTime}ms
                    </div>
                  </div>
                  <div className="bg-white border rounded p-3">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Request ID
                    </div>
                    <div className="font-mono text-sm text-gray-900 break-all">
                      {result.processingMetadata.requestId}
                    </div>
                  </div>
                  <div className="bg-white border rounded p-3">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      Timestamp
                    </div>
                    <div className="font-mono text-sm text-gray-900">
                      {new Date(result.processingMetadata.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'raw-data':
        return (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h4 
                className="text-lg font-medium text-gray-900"
                id="raw-data-heading"
              >
                Complete Response Data
              </h4>
              <div 
                className="flex flex-col sm:flex-row gap-2"
                role="group"
                aria-label="JSON data actions"
              >
                <button
                  onClick={() => copyToClipboard(formattedJSON)}
                  className="px-3 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                  type="button"
                  aria-label="Copy complete JSON data to clipboard"
                >
                  <span aria-hidden="true">📋</span> Copy JSON
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([formattedJSON], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `uscis-result-${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-2 text-sm bg-green-50 text-green-600 border border-green-200 rounded hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
                  type="button"
                  aria-label="Download JSON data as file"
                >
                  <span aria-hidden="true">💾</span> Download
                </button>
              </div>
            </div>
            <Suspense fallback={<LoadingSpinner variant="skeleton" skeletonType="json" message="Loading JSON viewer..." />}>
              <LazyJsonViewer 
                data={result} 
                formattedJson={formattedJSON}
                className="bg-gray-900 rounded-lg p-4 overflow-x-auto"
              />
            </Suspense>
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-gray-500">
            <p>Unknown tab selected.</p>
          </div>
        );
    }
  };

  return (
    <div 
      className={cn(
        "bg-white rounded-lg shadow-lg border border-gray-200",
        animations.fadeIn,
        presets.card.hover,
        presets.performance.respectMotionPreference
      )}
      data-testid="results-container"
      role="region"
      aria-labelledby="results-heading"
    >
      {/* Header with title and reset button */}
      <div className="border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
          <h3 
            id="results-heading"
            className="text-lg font-semibold text-gray-900"
          >
            Processing Results
          </h3>
          <button
            onClick={onReset}
            className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors rounded"
            type="button"
            aria-label="Start new request"
          >
            New Request
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav 
          className="flex space-x-0 overflow-x-auto scrollbar-hide" 
          aria-label="Result view tabs"
          role="tablist"
        >
          {availableTabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={cn(
                'flex-shrink-0 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                'transition-all duration-200 ease-in-out transform hover:scale-105',
                presets.performance.respectMotionPreference,
                getStaggerDelay(index),
                animations.slideInFromTop,
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 bg-blue-50 shadow-sm'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              )}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              title={tab.description}
            >
              <div className="flex items-center space-x-1 sm:space-x-2">
                <span className="text-sm sm:text-base" aria-hidden="true">{tab.icon}</span>
                <span>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div 
        className={cn(
          "p-4 sm:p-6",
          animations.fadeIn,
          presets.performance.respectMotionPreference
        )}
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        {renderTabContent()}
      </div>

      {/* Environment indicator for development */}
      {environment === 'development' && (
        <div 
          className="border-t border-gray-200 p-3 bg-blue-50"
          role="note"
          aria-label="Development mode notice"
        >
          <div className="text-xs text-blue-600">
            <span className="font-medium">Development Mode:</span> All tabs and debug information are visible
          </div>
        </div>
      )}
    </div>
  );
};

export default ResultsContainer;