import React from 'react';
import { cn } from '../utils';

interface SkeletonLoaderProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular' | 'card';
  width?: string | number;
  height?: string | number;
  lines?: number;
  animate?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  lines = 1,
  animate = true
}) => {
  const baseClasses = cn(
    'bg-gray-200',
    animate && 'animate-pulse',
    className
  );

  const getVariantClasses = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'rectangular':
        return 'rounded-md';
      case 'card':
        return 'rounded-lg';
      case 'text':
      default:
        return 'rounded';
    }
  };

  const getDefaultDimensions = () => {
    switch (variant) {
      case 'circular':
        return { width: '2rem', height: '2rem' };
      case 'rectangular':
        return { width: '100%', height: '1rem' };
      case 'card':
        return { width: '100%', height: '8rem' };
      case 'text':
      default:
        return { width: '100%', height: '1rem' };
    }
  };

  const dimensions = {
    width: width || getDefaultDimensions().width,
    height: height || getDefaultDimensions().height
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={cn(baseClasses, getVariantClasses())}
            style={{
              width: index === lines - 1 ? '75%' : dimensions.width,
              height: dimensions.height
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(baseClasses, getVariantClasses())}
      style={dimensions}
    />
  );
};

// Predefined skeleton components for common use cases
export const TextSkeleton: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 1, 
  className 
}) => (
  <SkeletonLoader variant="text" lines={lines} className={className} />
);

export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('p-4 border rounded-lg', className)}>
    <div className="space-y-3">
      <SkeletonLoader variant="rectangular" height="1.5rem" width="60%" />
      <SkeletonLoader variant="text" lines={3} />
      <div className="flex space-x-2">
        <SkeletonLoader variant="rectangular" height="2rem" width="5rem" />
        <SkeletonLoader variant="rectangular" height="2rem" width="5rem" />
      </div>
    </div>
  </div>
);

export const TableSkeleton: React.FC<{ 
  rows?: number; 
  columns?: number; 
  className?: string 
}> = ({ 
  rows = 3, 
  columns = 4, 
  className 
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: rows }, (_, rowIndex) => (
      <div key={rowIndex} className="flex space-x-4">
        {Array.from({ length: columns }, (_, colIndex) => (
          <SkeletonLoader
            key={colIndex}
            variant="rectangular"
            height="2rem"
            width={colIndex === 0 ? '25%' : '20%'}
          />
        ))}
      </div>
    ))}
  </div>
);

export const JsonSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('bg-gray-900 rounded-lg p-4', className)}>
    <div className="space-y-1">
      {Array.from({ length: 12 }, (_, index) => (
        <div key={index} className="flex">
          <SkeletonLoader
            variant="rectangular"
            height="1rem"
            width="2rem"
            className="bg-gray-700 mr-4"
            animate={false}
          />
          <SkeletonLoader
            variant="rectangular"
            height="1rem"
            width={`${Math.random() * 60 + 20}%`}
            className="bg-gray-700"
          />
        </div>
      ))}
    </div>
  </div>
);

export default SkeletonLoader;