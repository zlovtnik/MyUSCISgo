import type { ProcessingResult, Environment } from '../types';
import { ResultsContainer } from './results/ResultsContainer';

interface ResultDisplayProps {
  readonly result: ProcessingResult;
  readonly onReset?: () => void;
  readonly environment?: Environment;
}

export function ResultDisplay({ result, onReset, environment = 'development' }: ResultDisplayProps) {
  // Provide a default onReset function if not provided
  const handleReset = onReset || (() => {
    console.warn('No onReset function provided to ResultDisplay');
  });

  return (
    <div data-testid="result">
      <ResultsContainer 
        result={result}
        environment={environment}
        onReset={handleReset}
      />
    </div>
  );
}
