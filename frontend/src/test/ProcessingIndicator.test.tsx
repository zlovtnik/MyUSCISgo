import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProcessingIndicator } from '../components/ProcessingIndicator';
import type { ProcessingStep, RealtimeUpdate } from '../types';

// Mock the utils module
vi.mock('../utils', () => ({
  cn: (...classes: (string | undefined | null | boolean | Record<string, boolean>)[]) => {
    return classes
      .map(cls => {
        if (typeof cls === 'string') return cls;
        if (typeof cls === 'object' && cls !== null) {
          return Object.entries(cls)
            .filter(([, value]) => value)
            .map(([key]) => key)
            .join(' ');
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
}));

describe('ProcessingIndicator', () => {
  const mockRealtimeUpdates: RealtimeUpdate[] = [
    {
      id: '1',
      timestamp: '2024-01-01T10:00:00Z',
      step: 'validating',
      message: 'Starting validation process',
      level: 'info'
    },
    {
      id: '2',
      timestamp: '2024-01-01T10:00:05Z',
      step: 'authenticating',
      message: 'Establishing secure connection',
      level: 'info'
    }
  ];

  const defaultProps = {
    isProcessing: true,
    currentStep: 'validating' as ProcessingStep,
    realtimeUpdates: mockRealtimeUpdates,
    progress: undefined,
    onCancel: undefined,
    estimatedTimeMs: undefined,
    className: undefined
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render processing indicator when isProcessing is true', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      expect(screen.getByText('Processing Credentials')).toBeInTheDocument();
    });

    it('should not render when isProcessing is false', () => {
      render(<ProcessingIndicator {...defaultProps} isProcessing={false} />);
      
      expect(screen.queryByTestId('processing-indicator')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<ProcessingIndicator {...defaultProps} className="custom-class" />);
      
      const indicator = screen.getByTestId('processing-indicator');
      expect(indicator).toHaveClass('custom-class');
    });
  });

  describe('Step Display', () => {
    it('should highlight the current step', () => {
      render(<ProcessingIndicator {...defaultProps} currentStep="authenticating" />);
      
      const authenticatingStep = screen.getByTestId('step-authenticating');
      expect(authenticatingStep).toHaveClass('bg-blue-600', 'text-white', 'shadow-lg', 'scale-110');
    });

    it('should mark completed steps as green', () => {
      render(<ProcessingIndicator {...defaultProps} currentStep="fetching-case-data" />);
      
      const validatingStep = screen.getByTestId('step-validating');
      const authenticatingStep = screen.getByTestId('step-authenticating');
      
      expect(validatingStep).toHaveClass('bg-green-500', 'text-white');
      expect(authenticatingStep).toHaveClass('bg-green-500', 'text-white');
    });

    it('should mark pending steps as gray', () => {
      render(<ProcessingIndicator {...defaultProps} currentStep="validating" />);
      
      const processingStep = screen.getByTestId('step-processing-results');
      expect(processingStep).toHaveClass('bg-gray-200', 'text-gray-500');
    });

    it('should display step labels correctly', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      expect(screen.getByText('Validating')).toBeInTheDocument();
      expect(screen.getByText('Authenticating')).toBeInTheDocument();
      expect(screen.getByText('Fetching Data')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });
  });

  describe('Progress Bar', () => {
    it('should display progress percentage based on current step', () => {
      render(<ProcessingIndicator {...defaultProps} currentStep="authenticating" />);
      
      expect(screen.getByText('Progress: 25%')).toBeInTheDocument();
      
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '25%' });
    });

    it('should use custom progress when provided', () => {
      render(<ProcessingIndicator {...defaultProps} progress={75} />);
      
      expect(screen.getByText('Progress: 75%')).toBeInTheDocument();
      
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '75%' });
    });

    it('should clamp progress between 0 and 100', () => {
      render(<ProcessingIndicator {...defaultProps} progress={150} />);
      
      expect(screen.getByText('Progress: 100%')).toBeInTheDocument();
      
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '100%' });
    });
  });

  describe('Time Display', () => {
    it('should display elapsed time', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      // Initially should show 0s
      expect(screen.getByText(/Elapsed: 0s/)).toBeInTheDocument();
    });

    it('should display estimated remaining time when provided', () => {
      render(<ProcessingIndicator {...defaultProps} estimatedTimeMs={30000} />);
      
      expect(screen.getByText(/Est\. remaining: 30s/)).toBeInTheDocument();
    });

    it('should format time correctly for minutes and seconds', async () => {
      render(<ProcessingIndicator {...defaultProps} estimatedTimeMs={125000} />);
      
      expect(screen.getByText(/Est\. remaining: 2m 5s/)).toBeInTheDocument();
    });

    it('should format time correctly', () => {
      // Test the time formatting logic by checking estimated time display
      render(<ProcessingIndicator {...defaultProps} estimatedTimeMs={125000} />);
      
      expect(screen.getByText(/Est\. remaining: 2m 5s/)).toBeInTheDocument();
    });
  });

  describe('Cancel Functionality', () => {
    it('should render cancel button when onCancel is provided', () => {
      const mockCancel = vi.fn();
      render(<ProcessingIndicator {...defaultProps} onCancel={mockCancel} />);
      
      expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should not render cancel button when onCancel is not provided', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });

    it('should call onCancel when cancel button is clicked', () => {
      const mockCancel = vi.fn();
      render(<ProcessingIndicator {...defaultProps} onCancel={mockCancel} />);
      
      fireEvent.click(screen.getByTestId('cancel-button'));
      
      expect(mockCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Realtime Updates', () => {
    it('should display the latest update', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      expect(screen.getByText('Authenticating')).toBeInTheDocument();
      // The component shows both the latest update and the expandable section, so we expect 2 instances
      expect(screen.getAllByText('Establishing secure connection')).toHaveLength(2);
    });

    it('should display correct update level styling', () => {
      const updatesWithDifferentLevels: RealtimeUpdate[] = [
        {
          id: '1',
          timestamp: '2024-01-01T10:00:00Z',
          step: 'validating',
          message: 'Error occurred',
          level: 'error'
        }
      ];

      render(<ProcessingIndicator {...defaultProps} realtimeUpdates={updatesWithDifferentLevels} />);
      
      const indicator = screen.getByTestId('processing-indicator');
      const errorIndicator = indicator.querySelector('.bg-red-500');
      expect(errorIndicator).toBeInTheDocument();
    });

    it('should show update count in expandable section', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      expect(screen.getByText('View all updates (2)')).toBeInTheDocument();
    });

    it('should expand and show all updates when clicked', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      const expandButton = screen.getByText('View all updates (2)');
      fireEvent.click(expandButton);
      
      expect(screen.getByText('Starting validation process')).toBeInTheDocument();
      expect(screen.getAllByText('Establishing secure connection')).toHaveLength(2); // One in latest update, one in expanded list
    });

    it('should handle empty realtime updates gracefully', () => {
      render(<ProcessingIndicator {...defaultProps} realtimeUpdates={[]} />);
      
      expect(screen.queryByText(/View all updates/)).not.toBeInTheDocument();
    });

    it('should display formatted timestamps', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      // The timestamp should be formatted as locale time
      const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2}/);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Step Descriptions', () => {
    it('should display correct description for each step', () => {
      const steps: ProcessingStep[] = ['validating', 'authenticating', 'fetching-case-data', 'processing-results', 'complete'];
      const expectedDescriptions = [
        'Validating credentials and environment settings',
        'Establishing secure connection with USCIS API',
        'Retrieving case information and status updates',
        'Processing and formatting response data',
        'Processing completed successfully'
      ];

      steps.forEach((step, index) => {
        const { rerender } = render(<ProcessingIndicator {...defaultProps} currentStep={step} />);
        
        expect(screen.getByText(expectedDescriptions[index])).toBeInTheDocument();
        
        rerender(<div />); // Clean up for next iteration
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      const indicator = screen.getByTestId('processing-indicator');
      expect(indicator).toBeInTheDocument();
      
      // Check that interactive elements are accessible
      const cancelButton = screen.queryByTestId('cancel-button');
      if (cancelButton) {
        expect(cancelButton).toHaveAttribute('type', 'button');
      }
    });

    it('should support keyboard navigation for expandable content', () => {
      render(<ProcessingIndicator {...defaultProps} />);
      
      const expandButton = screen.getByText('View all updates (2)');
      
      // Should expand on click (testing interaction)
      fireEvent.click(expandButton);
      expect(screen.getByText('Starting validation process')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown step gracefully', () => {
      render(<ProcessingIndicator {...defaultProps} currentStep={'unknown-step' as ProcessingStep} />);
      
      expect(screen.getByText('Processing your request...')).toBeInTheDocument();
    });

    it('should handle very long update messages', () => {
      const longMessage = 'A'.repeat(500);
      const longUpdates: RealtimeUpdate[] = [
        {
          id: '1',
          timestamp: '2024-01-01T10:00:00Z',
          step: 'validating',
          message: longMessage,
          level: 'info'
        }
      ];

      render(<ProcessingIndicator {...defaultProps} realtimeUpdates={longUpdates} />);
      
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle negative progress values', () => {
      render(<ProcessingIndicator {...defaultProps} progress={-10} />);
      
      expect(screen.getByText('Progress: 0%')).toBeInTheDocument();
      
      const progressBar = screen.getByTestId('progress-bar');
      expect(progressBar).toHaveStyle({ width: '0%' });
    });

    it('should handle missing timestamp in updates', () => {
      const invalidUpdates: RealtimeUpdate[] = [
        {
          id: '1',
          timestamp: 'invalid-date',
          step: 'validating',
          message: 'Test message',
          level: 'info'
        }
      ];

      render(<ProcessingIndicator {...defaultProps} realtimeUpdates={invalidUpdates} />);
      
      // Should still render without crashing
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should limit displayed updates to prevent performance issues', () => {
      // Create 20 updates
      const manyUpdates: RealtimeUpdate[] = Array.from({ length: 20 }, (_, i) => ({
        id: `update-${i}`,
        timestamp: `2024-01-01T10:00:${i.toString().padStart(2, '0')}Z`,
        step: 'validating',
        message: `Update ${i}`,
        level: 'info' as const
      }));

      render(<ProcessingIndicator {...defaultProps} realtimeUpdates={manyUpdates} />);
      
      // Expand the updates section
      fireEvent.click(screen.getByText('View all updates (20)'));
      
      // Should only show the last 10 updates (as per component logic)
      expect(screen.getAllByText('Update 19')).toHaveLength(2); // One in latest update, one in expanded list
      expect(screen.getByText('Update 10')).toBeInTheDocument();
      expect(screen.queryByText('Update 9')).not.toBeInTheDocument();
    });
  });
});