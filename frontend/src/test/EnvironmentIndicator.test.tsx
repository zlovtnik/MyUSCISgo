import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EnvironmentIndicator } from '../components/EnvironmentIndicator';
import type { Environment, ProcessingMetadata } from '../types';

// Mock the utils module
vi.mock('../utils', () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(' ')
}));

describe('EnvironmentIndicator', () => {
  const mockProcessingMetadata: ProcessingMetadata = {
    environment: 'development',
    processingTime: 1250,
    requestId: 'req-123-456-789',
    timestamp: '2024-01-15T10:30:00Z'
  };

  beforeEach(() => {
    // Mock window properties
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 1080
    });

    // Mock navigator.userAgent
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });

    // Mock WebAssembly
    global.WebAssembly = {} as any;

    // Mock process.env
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders development environment correctly', () => {
      render(<EnvironmentIndicator environment="development" />);
      
      expect(screen.getByText('Development Environment')).toBeInTheDocument();
      expect(screen.getByText(/Debug features enabled/)).toBeInTheDocument();
      expect(screen.getByText('Debug Mode')).toBeInTheDocument();
      expect(screen.getByText('Mock Data')).toBeInTheDocument();
      expect(screen.getByText('Hot Reload')).toBeInTheDocument();
      expect(screen.getByText('Dev Tools')).toBeInTheDocument();
    });

    it('renders staging environment correctly', () => {
      render(<EnvironmentIndicator environment="staging" />);
      
      expect(screen.getAllByText('Staging Environment')).toHaveLength(2); // Badge and warning
      expect(screen.getByText(/Test environment/)).toBeInTheDocument();
      expect(screen.getByText('Test Mode')).toBeInTheDocument();
      expect(screen.getByText('Validation')).toBeInTheDocument();
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Pre-prod')).toBeInTheDocument();
    });

    it('renders production environment correctly', () => {
      render(<EnvironmentIndicator environment="production" />);
      
      expect(screen.getByText('Production Environment')).toBeInTheDocument();
      expect(screen.getByText(/Live environment/)).toBeInTheDocument();
      expect(screen.getByText('Live Data')).toBeInTheDocument();
      expect(screen.getByText('Security')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
    });

    it('returns null for invalid environment', () => {
      const { container } = render(
        <EnvironmentIndicator environment={'invalid' as Environment} />
      );
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Processing Metadata', () => {
    it('displays processing metadata when provided', () => {
      render(
        <EnvironmentIndicator 
          environment="development" 
          processingMetadata={mockProcessingMetadata}
        />
      );
      
      expect(screen.getByText('Processing Information')).toBeInTheDocument();
      expect(screen.getByText('req-123-456-789')).toBeInTheDocument();
      expect(screen.getByText('1250ms')).toBeInTheDocument();
      expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
    });

    it('does not display processing metadata section when not provided', () => {
      render(<EnvironmentIndicator environment="development" />);
      
      expect(screen.queryByText('Processing Information')).not.toBeInTheDocument();
    });
  });

  describe('Debug Information', () => {
    it('displays debug information in development when showDebugInfo is true', () => {
      render(
        <EnvironmentIndicator 
          environment="development" 
          showDebugInfo={true}
        />
      );
      
      expect(screen.getByText('Debug Information')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument(); // NODE_ENV
      expect(screen.getByText('1920x1080')).toBeInTheDocument(); // viewport
      expect(screen.getByText('Supported')).toBeInTheDocument(); // WASM support
      expect(screen.getByText(/Mozilla\/5\.0/)).toBeInTheDocument(); // user agent
    });

    it('does not display debug information when showDebugInfo is false', () => {
      render(
        <EnvironmentIndicator 
          environment="development" 
          showDebugInfo={false}
        />
      );
      
      expect(screen.queryByText('Debug Information')).not.toBeInTheDocument();
    });

    it('does not display debug information in non-development environments', () => {
      render(
        <EnvironmentIndicator 
          environment="production" 
          showDebugInfo={true}
        />
      );
      
      expect(screen.queryByText('Debug Information')).not.toBeInTheDocument();
    });

    it('shows WASM not supported when WebAssembly is undefined', () => {
      // Remove WebAssembly from global
      delete (global as any).WebAssembly;
      
      render(
        <EnvironmentIndicator 
          environment="development" 
          showDebugInfo={true}
        />
      );
      
      expect(screen.getByText('Not Supported')).toBeInTheDocument();
    });
  });

  describe('Environment-Specific Warnings', () => {
    it('displays development warning in development environment', () => {
      render(<EnvironmentIndicator environment="development" />);
      
      expect(screen.getByText('Development Mode Active')).toBeInTheDocument();
      expect(screen.getByText(/This environment includes debug features/)).toBeInTheDocument();
    });

    it('displays staging warning in staging environment', () => {
      render(<EnvironmentIndicator environment="staging" />);
      
      expect(screen.getAllByText('Staging Environment')).toHaveLength(2); // Badge and warning
      expect(screen.getByText(/This is a test environment/)).toBeInTheDocument();
    });

    it('does not display warnings in production environment', () => {
      render(<EnvironmentIndicator environment="production" />);
      
      expect(screen.queryByText('Development Mode Active')).not.toBeInTheDocument();
      expect(screen.queryByText(/This is a test environment/)).not.toBeInTheDocument();
    });
  });

  describe('Styling and Classes', () => {
    it('applies custom className when provided', () => {
      const { container } = render(
        <EnvironmentIndicator 
          environment="development" 
          className="custom-class"
        />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('applies environment-specific colors for development', () => {
      render(<EnvironmentIndicator environment="development" />);
      
      const badge = screen.getByText('Development Environment').closest('div');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200');
    });

    it('applies environment-specific colors for staging', () => {
      render(<EnvironmentIndicator environment="staging" />);
      
      const badges = screen.getAllByText('Staging Environment');
      const badge = badges[0].closest('div'); // Get the first one (the main badge)
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200');
    });

    it('applies environment-specific colors for production', () => {
      render(<EnvironmentIndicator environment="production" />);
      
      const badge = screen.getByText('Production Environment').closest('div');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200');
    });
  });

  describe('Feature Indicators', () => {
    it('displays correct feature indicators for development', () => {
      render(<EnvironmentIndicator environment="development" />);
      
      const features = ['Debug Mode', 'Mock Data', 'Hot Reload', 'Dev Tools'];
      features.forEach(feature => {
        expect(screen.getByText(feature)).toBeInTheDocument();
      });
    });

    it('displays correct feature indicators for staging', () => {
      render(<EnvironmentIndicator environment="staging" />);
      
      const features = ['Test Mode', 'Validation', 'Monitoring', 'Pre-prod'];
      features.forEach(feature => {
        expect(screen.getByText(feature)).toBeInTheDocument();
      });
    });

    it('displays correct feature indicators for production', () => {
      render(<EnvironmentIndicator environment="production" />);
      
      const features = ['Live Data', 'Security', 'Performance', 'Monitoring'];
      features.forEach(feature => {
        expect(screen.getByText(feature)).toBeInTheDocument();
      });
    });
  });

  describe('Icons', () => {
    it('renders info icon for development environment', () => {
      render(<EnvironmentIndicator environment="development" />);
      
      const badge = screen.getByText('Development Environment').closest('div');
      const icon = badge?.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-4', 'h-4');
    });

    it('renders warning icon for staging environment', () => {
      render(<EnvironmentIndicator environment="staging" />);
      
      const badges = screen.getAllByText('Staging Environment');
      const badge = badges[0].closest('div'); // Get the first one (the main badge)
      const icon = badge?.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-4', 'h-4');
    });

    it('renders checkmark icon for production environment', () => {
      render(<EnvironmentIndicator environment="production" />);
      
      const badge = screen.getByText('Production Environment').closest('div');
      const icon = badge?.querySelector('svg');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('w-4', 'h-4');
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(
        <EnvironmentIndicator 
          environment="development" 
          processingMetadata={mockProcessingMetadata}
          showDebugInfo={true}
        />
      );
      
      // Check for headings
      expect(screen.getByRole('heading', { name: 'Processing Information' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Debug Information' })).toBeInTheDocument();
    });

    it('provides meaningful text content for screen readers', () => {
      render(<EnvironmentIndicator environment="development" />);
      
      expect(screen.getByText('Development Environment')).toBeInTheDocument();
      expect(screen.getByText(/Debug features enabled/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing processing metadata gracefully', () => {
      render(
        <EnvironmentIndicator 
          environment="development" 
          processingMetadata={undefined}
        />
      );
      
      expect(screen.queryByText('Processing Information')).not.toBeInTheDocument();
    });

    it('handles invalid timestamp in processing metadata', () => {
      const invalidMetadata = {
        ...mockProcessingMetadata,
        timestamp: 'invalid-date'
      };
      
      render(
        <EnvironmentIndicator 
          environment="development" 
          processingMetadata={invalidMetadata}
        />
      );
      
      expect(screen.getByText('Processing Information')).toBeInTheDocument();
      // Should still render even with invalid date
      expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    });

    it('handles missing window properties gracefully', () => {
      // Mock missing window properties
      Object.defineProperty(window, 'innerWidth', {
        value: undefined,
        configurable: true
      });
      Object.defineProperty(window, 'innerHeight', {
        value: undefined,
        configurable: true
      });
      
      render(
        <EnvironmentIndicator 
          environment="development" 
          showDebugInfo={true}
        />
      );
      
      expect(screen.getByText('Debug Information')).toBeInTheDocument();
      expect(screen.getByText('undefinedxundefined')).toBeInTheDocument();
    });
  });
});