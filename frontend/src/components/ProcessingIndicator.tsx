import { useState, useEffect, useMemo } from 'react';
import { cn } from '../utils';
import type { ProcessingStep, RealtimeUpdate } from '../types';

interface ProcessingIndicatorProps {
  readonly isProcessing: boolean;
  readonly currentStep: ProcessingStep;
  readonly progress?: number; // 0-100
  readonly realtimeUpdates: RealtimeUpdate[];
  readonly onCancel?: () => void;
  readonly estimatedTimeMs?: number;
  readonly className?: string;
}

interface StepConfig {
  readonly key: ProcessingStep;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly estimatedDurationMs: number;
}

const PROCESSING_STEPS: readonly StepConfig[] = [
  {
    key: 'validating',
    label: 'Validating',
    description: 'Validating credentials and environment settings',
    icon: '🔍',
    estimatedDurationMs: 2000
  },
  {
    key: 'authenticating',
    label: 'Authenticating',
    description: 'Establishing secure connection with USCIS API',
    icon: '🔐',
    estimatedDurationMs: 5000
  },
  {
    key: 'fetching-case-data',
    label: 'Fetching Data',
    description: 'Retrieving case information and status updates',
    icon: '📡',
    estimatedDurationMs: 8000
  },
  {
    key: 'processing-results',
    label: 'Processing',
    description: 'Processing and formatting response data',
    icon: '⚙️',
    estimatedDurationMs: 3000
  },
  {
    key: 'complete',
    label: 'Complete',
    description: 'Processing completed successfully',
    icon: '✅',
    estimatedDurationMs: 0
  }
] as const;

export function ProcessingIndicator({
  isProcessing,
  currentStep,
  progress,
  realtimeUpdates,
  onCancel,
  estimatedTimeMs,
  className
}: ProcessingIndicatorProps) {
  const [startTime] = useState(() => Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);

  // Update elapsed time every second while processing
  useEffect(() => {
    if (!isProcessing) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [isProcessing, startTime]);

  // Calculate estimated completion time
  const estimatedCompletion = useMemo(() => {
    if (estimatedTimeMs) {
      return estimatedTimeMs;
    }

    // Calculate based on current step and typical durations
    const currentStepIndex = PROCESSING_STEPS.findIndex(step => step.key === currentStep);
    if (currentStepIndex === -1) return 0;

    const remainingSteps = PROCESSING_STEPS.slice(currentStepIndex);
    return remainingSteps.reduce((total, step) => total + step.estimatedDurationMs, 0);
  }, [currentStep, estimatedTimeMs]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (progress !== undefined) {
      return Math.min(100, Math.max(0, progress));
    }

    // Calculate based on current step
    const currentStepIndex = PROCESSING_STEPS.findIndex(step => step.key === currentStep);
    if (currentStepIndex === -1) return 0;

    return Math.round((currentStepIndex / (PROCESSING_STEPS.length - 1)) * 100);
  }, [currentStep, progress]);

  // Get current step configuration
  const currentStepConfig = PROCESSING_STEPS.find(step => step.key === currentStep);

  // Format time display
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  // Get the latest update for display
  const latestUpdate = realtimeUpdates.length > 0 
    ? realtimeUpdates[realtimeUpdates.length - 1] 
    : null;

  if (!isProcessing) {
    return null;
  }

  return (
    <div 
      className={cn('bg-white rounded-lg shadow-lg p-4 sm:p-6', className)}
      data-testid="processing-indicator"
      role="status"
      aria-live="polite"
      aria-labelledby="processing-heading"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <div className="flex items-center space-x-3">
          <div 
            className="animate-spin"
            aria-hidden="true"
          >
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <div>
            <h3 
              id="processing-heading"
              className="text-lg font-semibold text-gray-900"
            >
              Processing Credentials
            </h3>
            <p 
              className="text-sm text-gray-600"
              aria-live="polite"
            >
              {currentStepConfig?.description || 'Processing your request...'}
            </p>
          </div>
        </div>
        
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            data-testid="cancel-button"
            type="button"
            aria-label="Cancel processing"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
          <span 
            className="text-sm font-medium text-gray-700"
            id="progress-label"
          >
            Progress: {progressPercentage}%
          </span>
          <div className="text-xs sm:text-sm text-gray-500 flex flex-col sm:flex-row gap-1 sm:gap-4">
            <span>Elapsed: {formatTime(elapsedTime)}</span>
            {estimatedCompletion > 0 && (
              <span>Est. remaining: {formatTime(Math.max(0, estimatedCompletion - elapsedTime))}</span>
            )}
          </div>
        </div>
        <div 
          className="w-full bg-gray-200 rounded-full h-2"
          role="progressbar"
          aria-labelledby="progress-label"
          aria-valuenow={progressPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${progressPercentage}% complete`}
        >
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
            data-testid="progress-bar"
          />
        </div>
      </div>

      {/* Step Indicators */}
      <div className="mb-4 sm:mb-6">
        <div 
          className="relative flex items-center justify-between"
          role="group"
          aria-label="Processing steps"
        >
          {PROCESSING_STEPS.map((step, index) => {
            const isActive = step.key === currentStep;
            const isCompleted = PROCESSING_STEPS.findIndex(s => s.key === currentStep) > index;
            const isPending = !isActive && !isCompleted;

            return (
              <div key={step.key} className="flex flex-col items-center flex-1 relative">
                {/* Step Icon */}
                <div
                  className={cn(
                    'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all duration-200 relative z-10',
                    {
                      'bg-blue-600 text-white shadow-lg scale-110': isActive,
                      'bg-green-500 text-white': isCompleted,
                      'bg-gray-200 text-gray-500': isPending
                    }
                  )}
                  data-testid={`step-${step.key}`}
                  role="img"
                  aria-label={`${step.label}: ${isCompleted ? 'completed' : isActive ? 'in progress' : 'pending'}`}
                >
                  {isCompleted ? '✓' : step.icon}
                </div>
                
                {/* Step Label */}
                <div className="mt-1 sm:mt-2 text-center">
                  <div
                    className={cn(
                      'text-xs font-medium px-1',
                      {
                        'text-blue-600': isActive,
                        'text-green-600': isCompleted,
                        'text-gray-500': isPending
                      }
                    )}
                  >
                    <span className="hidden sm:inline">{step.label}</span>
                    <span className="sm:hidden">{step.label.substring(0, 4)}</span>
                  </div>
                </div>

                {/* Connector Line */}
                {index < PROCESSING_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'absolute top-4 sm:top-5 h-0.5 transition-all duration-200 z-0',
                      {
                        'bg-green-500': isCompleted,
                        'bg-gray-300': !isCompleted
                      }
                    )}
                    style={{
                      left: '50%',
                      right: `${-100 / (PROCESSING_STEPS.length - 1)}%`,
                      width: `${100 / (PROCESSING_STEPS.length - 1)}%`
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Latest Update */}
      {latestUpdate && (
        <div 
          className="border-t pt-4"
          role="region"
          aria-labelledby="latest-update-heading"
        >
          <div className="flex items-start space-x-3">
            <div
              className={cn(
                'w-2 h-2 rounded-full mt-2 flex-shrink-0',
                {
                  'bg-blue-500': latestUpdate.level === 'info',
                  'bg-yellow-500': latestUpdate.level === 'warning',
                  'bg-red-500': latestUpdate.level === 'error',
                  'bg-green-500': latestUpdate.level === 'success'
                }
              )}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
                <p 
                  id="latest-update-heading"
                  className="text-sm font-medium text-gray-900 capitalize"
                >
                  {latestUpdate.step.replace('-', ' ')}
                </p>
                <p className="text-xs text-gray-500">
                  <time dateTime={latestUpdate.timestamp}>
                    {new Date(latestUpdate.timestamp).toLocaleTimeString()}
                  </time>
                </p>
              </div>
              <p 
                className="text-sm text-gray-600 mt-1"
                aria-live="polite"
              >
                {latestUpdate.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Updates Summary */}
      {realtimeUpdates.length > 1 && (
        <div className="mt-4 pt-4 border-t">
          <details className="group">
            <summary 
              className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded flex items-center justify-between p-2 -m-2"
              aria-expanded="false"
            >
              <span>View all updates ({realtimeUpdates.length})</span>
              <svg 
                className="w-4 h-4 transition-transform group-open:rotate-180" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div 
              className="mt-3 space-y-2 max-h-40 overflow-y-auto"
              role="log"
              aria-label="Processing update history"
            >
              {realtimeUpdates.slice(-10).reverse().map((update, index) => (
                <div 
                  key={`${update.id}-${index}`} 
                  className="text-xs bg-gray-50 p-2 rounded"
                  role="listitem"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                    <span
                      className={cn(
                        'font-medium capitalize',
                        {
                          'text-blue-600': update.level === 'info',
                          'text-yellow-600': update.level === 'warning',
                          'text-red-600': update.level === 'error',
                          'text-green-600': update.level === 'success'
                        }
                      )}
                    >
                      {update.step.replace('-', ' ')}
                    </span>
                    <span className="text-gray-500 text-xs">
                      <time dateTime={update.timestamp}>
                        {new Date(update.timestamp).toLocaleTimeString()}
                      </time>
                    </span>
                  </div>
                  <p className="text-gray-700 mt-1">
                    {update.message}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}