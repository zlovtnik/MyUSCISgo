import { cn } from '../utils';
import { SkeletonLoader } from './SkeletonLoader';

interface LoadingSpinnerProps {
  readonly size?: 'sm' | 'md' | 'lg';
  readonly message?: string;
  readonly className?: string;
  readonly variant?: 'spinner' | 'skeleton';
  readonly skeletonType?: 'text' | 'card' | 'json';
}

export function LoadingSpinner({
  size = 'md',
  message = 'Loading...',
  className,
  variant = 'spinner',
  skeletonType = 'text'
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  };

  if (variant === 'skeleton') {
    const skeletonProps = {
      text: { lines: 3, className: 'w-full' },
      card: { variant: 'card' as const, className: 'w-full h-32' },
      json: { variant: 'rectangular' as const, className: 'w-full h-48 bg-gray-800' }
    };

    return (
      <div className={cn('space-y-3', className)} data-testid="skeleton-loader">
        <SkeletonLoader {...skeletonProps[skeletonType]} />
        {message && (
          <div className="text-center">
            <SkeletonLoader variant="text" width="60%" className="mx-auto" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center space-y-3', className)} data-testid="processing-indicator">
      <svg
        className={cn(
          'animate-spin text-blue-600',
          sizeClasses[size]
        )}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {message && (
        <p className="text-sm text-gray-600 animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
