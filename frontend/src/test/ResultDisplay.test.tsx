import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultDisplay } from '../components/ResultDisplay';
import type { ProcessingResult } from '../types';

// Mock the ResultsContainer component
vi.mock('../components/results/ResultsContainer', () => ({
  ResultsContainer: ({ result, environment, onReset }: any) => (
    <div data-testid="results-container">
      <div data-testid="result-base-url">{result.baseURL}</div>
      <div data-testid="environment">{environment}</div>
      <button onClick={onReset} data-testid="reset-button">Reset</button>
    </div>
  )
}));

describe('ResultDisplay', () => {
  const mockResult: ProcessingResult = {
    baseURL: 'https://api.uscis.gov',
    authMode: 'oauth',
    tokenHint: 'test-token-hint',
    config: {
      'client_id': 'test-client-id',
      'environment': 'development'
    }
  };

  it('should render ResultsContainer with correct props', () => {
    const mockOnReset = vi.fn();
    
    render(
      <ResultDisplay 
        result={mockResult}
        onReset={mockOnReset}
        environment="production"
      />
    );

    expect(screen.getByTestId('results-container')).toBeInTheDocument();
    expect(screen.getByTestId('result-base-url')).toHaveTextContent('https://api.uscis.gov');
    expect(screen.getByTestId('environment')).toHaveTextContent('production');
  });

  it('should use default environment when not provided', () => {
    const mockOnReset = vi.fn();
    
    render(
      <ResultDisplay 
        result={mockResult}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByTestId('environment')).toHaveTextContent('development');
  });

  it('should handle reset button click', () => {
    const mockOnReset = vi.fn();
    
    render(
      <ResultDisplay 
        result={mockResult}
        onReset={mockOnReset}
      />
    );

    screen.getByTestId('reset-button').click();
    expect(mockOnReset).toHaveBeenCalledOnce();
  });

  it('should provide default onReset when not provided', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    render(
      <ResultDisplay 
        result={mockResult}
      />
    );

    screen.getByTestId('reset-button').click();
    expect(consoleSpy).toHaveBeenCalledWith('No onReset function provided to ResultDisplay');
    
    consoleSpy.mockRestore();
  });

  it('should render with data-testid="result"', () => {
    render(
      <ResultDisplay 
        result={mockResult}
      />
    );

    expect(screen.getByTestId('result')).toBeInTheDocument();
  });
});