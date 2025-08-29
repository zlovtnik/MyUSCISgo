import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { cn } from '../utils';
import type { RealtimeUpdate, ProcessingStep } from '../types';

interface RealtimeUpdatesDisplayProps {
  readonly updates: RealtimeUpdate[];
  readonly onClear: () => void;
  readonly isProcessing?: boolean;
  readonly className?: string;
}

interface FilterOptions {
  level: 'all' | 'info' | 'warning' | 'error' | 'success';
  step: 'all' | ProcessingStep;
  searchTerm: string;
}

const LEVEL_COLORS = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  success: 'bg-green-50 border-green-200 text-green-800'
} as const;

const LEVEL_ICONS = {
  info: '💡',
  warning: '⚠️',
  error: '❌',
  success: '✅'
} as const;

const STEP_LABELS = {
  validating: 'Validation',
  authenticating: 'Authentication',
  'fetching-case-data': 'Data Fetching',
  'processing-results': 'Processing',
  complete: 'Complete'
} as const;

export function RealtimeUpdatesDisplay({
  updates,
  onClear,
  isProcessing = false,
  className
}: RealtimeUpdatesDisplayProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    level: 'all',
    step: 'all',
    searchTerm: ''
  });
  const [isExpanded, setIsExpanded] = useState(true);
  const [throttledUpdates, setThrottledUpdates] = useState<RealtimeUpdate[]>(updates);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Throttle updates to prevent UI flooding during high-frequency updates
  useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    const THROTTLE_DELAY = 100; // 100ms throttle

    if (timeSinceLastUpdate >= THROTTLE_DELAY) {
      setThrottledUpdates(updates);
      lastUpdateTimeRef.current = now;
    } else {
      // Clear existing timeout and set a new one
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
      
      throttleTimeoutRef.current = setTimeout(() => {
        setThrottledUpdates(updates);
        lastUpdateTimeRef.current = Date.now();
      }, THROTTLE_DELAY - timeSinceLastUpdate);
    }

    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, [updates]);

  // Filter and search updates using throttled updates
  const filteredUpdates = useMemo(() => {
    return throttledUpdates.filter(update => {
      // Level filter
      if (filters.level !== 'all' && update.level !== filters.level) {
        return false;
      }

      // Step filter
      if (filters.step !== 'all' && update.step !== filters.step) {
        return false;
      }

      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        return (
          update.message.toLowerCase().includes(searchLower) ||
          update.step.toLowerCase().includes(searchLower) ||
          update.level.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [throttledUpdates, filters]);

  // Group updates by step for better organization
  const groupedUpdates = useMemo(() => {
    const groups: Record<ProcessingStep, RealtimeUpdate[]> = {
      validating: [],
      authenticating: [],
      'fetching-case-data': [],
      'processing-results': [],
      complete: []
    };

    filteredUpdates.forEach(update => {
      if (groups[update.step]) {
        groups[update.step].push(update);
      }
    });

    return groups;
  }, [filteredUpdates]);

  // Statistics for display using throttled updates
  const statistics = useMemo(() => {
    const levelCounts = throttledUpdates.reduce((acc, update) => {
      acc[update.level] = (acc[update.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const stepCounts = throttledUpdates.reduce((acc, update) => {
      acc[update.step] = (acc[update.step] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { levelCounts, stepCounts };
  }, [throttledUpdates]);

  const handleFilterChange = useCallback((key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearSearch = useCallback(() => {
    setFilters(prev => ({ ...prev, searchTerm: '' }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      level: 'all',
      step: 'all',
      searchTerm: ''
    });
  }, []);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  // Get relative time
  const getRelativeTime = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      
      if (diffSeconds < 60) return `${diffSeconds}s ago`;
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
      return `${Math.floor(diffSeconds / 3600)}h ago`;
    } catch {
      return 'Unknown';
    }
  };

  if (throttledUpdates.length === 0) {
    return null;
  }

  return (
    <div 
      className={cn('bg-white rounded-lg shadow-lg', className)}
      data-testid="realtime-updates-display"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center space-x-2 text-lg font-semibold text-gray-900 hover:text-gray-700 transition-colors"
              data-testid="toggle-expansion"
            >
              <svg 
                className={cn('w-5 h-5 transition-transform', { 'rotate-90': isExpanded })}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Real-time Updates</span>
            </button>
            
            {isProcessing && (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-green-600 font-medium">Live</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {filteredUpdates.length} of {throttledUpdates.length} updates
              {throttledUpdates.length !== updates.length && (
                <span className="text-xs text-blue-600 ml-1">(throttled)</span>
              )}
            </span>
            <button
              onClick={onClear}
              className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors"
              data-testid="clear-updates"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(statistics.levelCounts).map(([level, count]) => (
            <span
              key={level}
              className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                LEVEL_COLORS[level as keyof typeof LEVEL_COLORS]
              )}
            >
              {LEVEL_ICONS[level as keyof typeof LEVEL_ICONS]} {level}: {count}
            </span>
          ))}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Filters */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search updates..."
                  value={filters.searchTerm}
                  onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  data-testid="search-input"
                />
                <svg 
                  className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {filters.searchTerm && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 hover:text-gray-600"
                    data-testid="clear-search"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Level Filter */}
              <select
                value={filters.level}
                onChange={(e) => handleFilterChange('level', e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                data-testid="level-filter"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="success">Success</option>
              </select>

              {/* Step Filter */}
              <select
                value={filters.step}
                onChange={(e) => handleFilterChange('step', e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                data-testid="step-filter"
              >
                <option value="all">All Steps</option>
                {Object.entries(STEP_LABELS).map(([step, label]) => (
                  <option key={step} value={step}>{label}</option>
                ))}
              </select>
            </div>

            {/* Filter Actions */}
            <div className="mt-3 flex justify-between items-center">
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                data-testid="reset-filters"
              >
                Reset Filters
              </button>
              
              {(filters.level !== 'all' || filters.step !== 'all' || filters.searchTerm) && (
                <span className="text-sm text-gray-600">
                  Filters active
                </span>
              )}
            </div>
          </div>

          {/* Updates List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredUpdates.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0118 12M6 20.291A7.962 7.962 0 016 12m0 8.291A7.962 7.962 0 016 12m0 8.291A7.962 7.962 0 016 12" />
                </svg>
                <p className="text-lg font-medium mb-2">No updates match your filters</p>
                <p className="text-sm">Try adjusting your search terms or filters</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {Object.entries(groupedUpdates).map(([step, stepUpdates]) => {
                  if (stepUpdates.length === 0) return null;

                  return (
                    <div key={step} className="p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2" />
                        {STEP_LABELS[step as ProcessingStep]} ({stepUpdates.length})
                      </h4>
                      
                      <div className="space-y-2">
                        {stepUpdates.map((update, index) => (
                          <div
                            key={`${update.id}-${index}`}
                            className={cn(
                              'p-3 rounded-lg border transition-all duration-200 hover:shadow-sm',
                              LEVEL_COLORS[update.level]
                            )}
                            data-testid={`update-${update.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-2 flex-1">
                                <span className="text-lg leading-none">
                                  {LEVEL_ICONS[update.level]}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 break-words">
                                    {update.message}
                                  </p>
                                  <div className="mt-1 flex items-center space-x-3 text-xs text-gray-600">
                                    <span>{formatTimestamp(update.timestamp)}</span>
                                    <span>•</span>
                                    <span>{getRelativeTime(update.timestamp)}</span>
                                    <span>•</span>
                                    <span className="capitalize">{update.level}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}