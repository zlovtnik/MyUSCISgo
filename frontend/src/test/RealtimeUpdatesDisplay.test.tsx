import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RealtimeUpdatesDisplay } from '../components/RealtimeUpdatesDisplay';
import type { RealtimeUpdate } from '../types';

// Mock data
const mockUpdates: RealtimeUpdate[] = [
  {
    id: '1',
    timestamp: '2024-01-01T10:00:00Z',
    step: 'validating',
    message: 'Validating credentials format',
    level: 'info'
  },
  {
    id: '2',
    timestamp: '2024-01-01T10:00:05Z',
    step: 'authenticating',
    message: 'Establishing secure connection',
    level: 'info'
  },
  {
    id: '3',
    timestamp: '2024-01-01T10:00:10Z',
    step: 'fetching-case-data',
    message: 'Retrieving case information',
    level: 'info'
  },
  {
    id: '4',
    timestamp: '2024-01-01T10:00:15Z',
    step: 'processing-results',
    message: 'Processing completed successfully',
    level: 'success'
  },
  {
    id: '5',
    timestamp: '2024-01-01T10:00:20Z',
    step: 'validating',
    message: 'Warning: Some fields may be incomplete',
    level: 'warning'
  },
  {
    id: '6',
    timestamp: '2024-01-01T10:00:25Z',
    step: 'authenticating',
    message: 'Authentication failed - retrying',
    level: 'error'
  }
];

describe('RealtimeUpdatesDisplay', () => {
  const mockOnClear = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without updates', () => {
    const { container } = render(
      <RealtimeUpdatesDisplay updates={[]} onClear={mockOnClear} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders with updates', () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    expect(screen.getByTestId('realtime-updates-display')).toBeInTheDocument();
    expect(screen.getByText('Real-time Updates')).toBeInTheDocument();
    expect(screen.getByText('6 of 6 updates')).toBeInTheDocument();
  });

  it('displays statistics correctly', () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    // Check level statistics
    expect(screen.getByText(/info: 3/)).toBeInTheDocument();
    expect(screen.getByText(/success: 1/)).toBeInTheDocument();
    expect(screen.getByText(/warning: 1/)).toBeInTheDocument();
    expect(screen.getByText(/error: 1/)).toBeInTheDocument();
  });

  it('shows live indicator when processing', () => {
    render(
      <RealtimeUpdatesDisplay 
        updates={mockUpdates} 
        onClear={mockOnClear} 
        isProcessing={true}
      />
    );
    
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('can be collapsed and expanded', () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    const toggleButton = screen.getByTestId('toggle-expansion');
    
    // Should be expanded by default
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    
    // Collapse
    fireEvent.click(toggleButton);
    expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
    
    // Expand again
    fireEvent.click(toggleButton);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('filters updates by search term', async () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    const searchInput = screen.getByTestId('search-input');
    
    // Search for "authentication"
    fireEvent.change(searchInput, { target: { value: 'authentication' } });
    
    await waitFor(() => {
      expect(screen.getByText('1 of 6 updates')).toBeInTheDocument();
    });
    
    // Should show authentication-related updates (only the error one matches "authentication")
    expect(screen.getByText('Authentication failed - retrying')).toBeInTheDocument();
  });

  it('filters updates by level', async () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    const levelFilter = screen.getByTestId('level-filter');
    
    // Filter by error level
    fireEvent.change(levelFilter, { target: { value: 'error' } });
    
    await waitFor(() => {
      expect(screen.getByText('1 of 6 updates')).toBeInTheDocument();
    });
    
    // Should show only error updates
    expect(screen.getByText('Authentication failed - retrying')).toBeInTheDocument();
  });

  it('filters updates by step', async () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    const stepFilter = screen.getByTestId('step-filter');
    
    // Filter by validating step
    fireEvent.change(stepFilter, { target: { value: 'validating' } });
    
    await waitFor(() => {
      expect(screen.getByText('2 of 6 updates')).toBeInTheDocument();
    });
    
    // Should show only validating updates
    expect(screen.getByText('Validating credentials format')).toBeInTheDocument();
    expect(screen.getByText('Warning: Some fields may be incomplete')).toBeInTheDocument();
  });

  it('can clear search', async () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    const searchInput = screen.getByTestId('search-input');
    
    // Add search term
    fireEvent.change(searchInput, { target: { value: 'authentication' } });
    
    await waitFor(() => {
      expect(screen.getByText('1 of 6 updates')).toBeInTheDocument();
    });
    
    // Clear search
    const clearSearchButton = screen.getByTestId('clear-search');
    fireEvent.click(clearSearchButton);
    
    await waitFor(() => {
      expect(screen.getByText('6 of 6 updates')).toBeInTheDocument();
    });
    
    expect(searchInput).toHaveValue('');
  });

  it('can reset all filters', async () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    const searchInput = screen.getByTestId('search-input');
    const levelFilter = screen.getByTestId('level-filter');
    const stepFilter = screen.getByTestId('step-filter');
    
    // Apply filters
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.change(levelFilter, { target: { value: 'error' } });
    fireEvent.change(stepFilter, { target: { value: 'validating' } });
    
    // Reset filters
    const resetButton = screen.getByTestId('reset-filters');
    fireEvent.click(resetButton);
    
    await waitFor(() => {
      expect(searchInput).toHaveValue('');
      expect(levelFilter).toHaveValue('all');
      expect(stepFilter).toHaveValue('all');
      expect(screen.getByText('6 of 6 updates')).toBeInTheDocument();
    });
  });

  it('calls onClear when clear button is clicked', () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    const clearButton = screen.getByTestId('clear-updates');
    fireEvent.click(clearButton);
    
    expect(mockOnClear).toHaveBeenCalledTimes(1);
  });

  it('groups updates by step', () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    // Check that step groups are displayed
    expect(screen.getByText('Validation (2)')).toBeInTheDocument();
    expect(screen.getByText('Authentication (2)')).toBeInTheDocument();
    expect(screen.getByText('Data Fetching (1)')).toBeInTheDocument();
    expect(screen.getByText('Processing (1)')).toBeInTheDocument();
  });

  it('displays no results message when filters match nothing', async () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    const searchInput = screen.getByTestId('search-input');
    
    // Search for something that doesn't exist
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    await waitFor(() => {
      expect(screen.getByText('0 of 6 updates')).toBeInTheDocument();
      expect(screen.getByText('No updates match your filters')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search terms or filters')).toBeInTheDocument();
    });
  });

  it('formats timestamps correctly', () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    // Check that timestamps are formatted (should show time in HH:MM:SS format)
    // Use getAllByText since there are multiple timestamps
    const timestamps = screen.getAllByText(/\d{2}:\d{2}:\d{2}/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it('displays level icons correctly', () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    // Check that level icons are displayed in the updates
    const updateElements = screen.getAllByTestId(/^update-/);
    expect(updateElements.length).toBeGreaterThan(0);
    
    // Check that different level icons are present (use getAllByText since there are multiple)
    expect(screen.getAllByText('💡')).toHaveLength(3); // info (3 instances)
    expect(screen.getAllByText('✅')).toHaveLength(1); // success (1 instance)
    expect(screen.getAllByText('⚠️')).toHaveLength(1); // warning (1 instance)
    expect(screen.getAllByText('❌')).toHaveLength(1); // error (1 instance)
  });

  it('handles empty step groups correctly', () => {
    const limitedUpdates: RealtimeUpdate[] = [
      {
        id: '1',
        timestamp: '2024-01-01T10:00:00Z',
        step: 'validating',
        message: 'Validating credentials',
        level: 'info'
      }
    ];
    
    render(
      <RealtimeUpdatesDisplay updates={limitedUpdates} onClear={mockOnClear} />
    );
    
    // Should only show the validation group
    expect(screen.getByText('Validation (1)')).toBeInTheDocument();
    
    // Other groups should not be displayed
    expect(screen.queryByText('Authentication (')).not.toBeInTheDocument();
    expect(screen.queryByText('Data Fetching (')).not.toBeInTheDocument();
  });

  it('applies correct CSS classes for different levels', () => {
    render(
      <RealtimeUpdatesDisplay updates={mockUpdates} onClear={mockOnClear} />
    );
    
    // Check that updates have appropriate styling based on level
    const errorUpdate = screen.getByTestId('update-6');
    expect(errorUpdate).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800');
    
    const successUpdate = screen.getByTestId('update-4');
    expect(successUpdate).toHaveClass('bg-green-50', 'border-green-200', 'text-green-800');
  });
});