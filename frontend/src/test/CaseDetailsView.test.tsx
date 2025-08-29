import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CaseDetailsView from '../components/results/CaseDetailsView';
import { CaseDetails, Environment } from '../types';

// Mock data for testing
const mockCaseDetails: CaseDetails = {
  caseNumber: 'MSC2190000001',
  currentStatus: 'Case Was Approved',
  processingCenter: 'National Benefits Center',
  priorityDate: '2021-03-15T00:00:00Z',
  caseType: 'I-485, Application to Adjust Status',
  approvalDate: '2023-08-20T00:00:00Z',
  lastUpdated: '2023-08-21T10:30:00Z',
  verificationId: 'VER-123456789'
};

const mockCaseDetailsWithoutOptionalFields: CaseDetails = {
  currentStatus: 'Case Is Being Actively Reviewed',
  processingCenter: 'Texas Service Center',
  priorityDate: '2022-01-10T00:00:00Z',
  caseType: 'I-130, Petition for Alien Relative',
  lastUpdated: '2023-12-01T15:45:00Z'
};

describe('CaseDetailsView', () => {
  beforeEach(() => {
    // Mock current date for consistent relative time testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-12-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('renders case details with all fields', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="production" 
        />
      );

      // Check header
      expect(screen.getByText('Case Details')).toBeInTheDocument();
      expect(screen.getByText('Case Number: MSC2190000001')).toBeInTheDocument();

      // Check status badge
      expect(screen.getByText('Case Was Approved')).toBeInTheDocument();

      // Check case information
      expect(screen.getByText('Processing Center')).toBeInTheDocument();
      expect(screen.getByText('National Benefits Center')).toBeInTheDocument();
      
      expect(screen.getByText('Case Type')).toBeInTheDocument();
      expect(screen.getByText('I-485, Application to Adjust Status')).toBeInTheDocument();
      
      expect(screen.getByText('Priority Date')).toBeInTheDocument();
      expect(screen.getByText('March 14, 2021')).toBeInTheDocument();
      
      expect(screen.getByText('Approval Date')).toBeInTheDocument();
      expect(screen.getByText('August 19, 2023')).toBeInTheDocument();

      // Check verification ID
      expect(screen.getByText('Verification ID:')).toBeInTheDocument();
      expect(screen.getByText('VER-123456789')).toBeInTheDocument();
    });

    it('renders case details without optional fields', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetailsWithoutOptionalFields} 
          environment="production" 
        />
      );

      // Should not show case number
      expect(screen.queryByText(/Case Number:/)).not.toBeInTheDocument();
      
      // Should not show approval date
      expect(screen.queryByText('Approval Date')).not.toBeInTheDocument();
      
      // Should not show verification ID
      expect(screen.queryByText('Verification ID:')).not.toBeInTheDocument();

      // Should still show required fields
      expect(screen.getByText('Case Is Being Actively Reviewed')).toBeInTheDocument();
      expect(screen.getByText('Texas Service Center')).toBeInTheDocument();
      expect(screen.getByText('I-130, Petition for Alien Relative')).toBeInTheDocument();
    });
  });

  describe('Status Badge Color Coding', () => {
    it('shows green badge for approved status', () => {
      render(
        <CaseDetailsView 
          caseDetails={{...mockCaseDetails, currentStatus: 'Case Was Approved'}} 
          environment="production" 
        />
      );

      const statusBadge = screen.getByText('Case Was Approved');
      expect(statusBadge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200');
    });

    it('shows yellow badge for pending status', () => {
      render(
        <CaseDetailsView 
          caseDetails={{...mockCaseDetails, currentStatus: 'Case Is Pending Review'}} 
          environment="production" 
        />
      );

      const statusBadge = screen.getByText('Case Is Pending Review');
      expect(statusBadge).toHaveClass('bg-yellow-100', 'text-yellow-800', 'border-yellow-200');
    });

    it('shows red badge for denied status', () => {
      render(
        <CaseDetailsView 
          caseDetails={{...mockCaseDetails, currentStatus: 'Case Was Denied'}} 
          environment="production" 
        />
      );

      const statusBadge = screen.getByText('Case Was Denied');
      expect(statusBadge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200');
    });

    it('shows blue badge for processing status', () => {
      render(
        <CaseDetailsView 
          caseDetails={{...mockCaseDetails, currentStatus: 'Case Is Being Actively Processed'}} 
          environment="production" 
        />
      );

      const statusBadge = screen.getByText('Case Is Being Actively Processed');
      expect(statusBadge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200');
    });

    it('shows gray badge for unknown status', () => {
      render(
        <CaseDetailsView 
          caseDetails={{...mockCaseDetails, currentStatus: 'Unknown Status'}} 
          environment="production" 
        />
      );

      const statusBadge = screen.getByText('Unknown Status');
      expect(statusBadge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-200');
    });
  });

  describe('Date Formatting', () => {
    it('formats dates correctly', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="production" 
        />
      );

      // Check formatted dates (dates are formatted based on the mock system time)
      expect(screen.getByText('March 14, 2021')).toBeInTheDocument();
      expect(screen.getByText('August 19, 2023')).toBeInTheDocument();
      expect(screen.getByText(/August 21, 2023/)).toBeInTheDocument();
    });

    it('shows relative time for dates', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="production" 
        />
      );

      // Priority date should show years ago
      expect(screen.getByText('2 years ago')).toBeInTheDocument();
      
      // Approval date should show months ago (there are multiple instances, so use getAllByText)
      const monthsAgoElements = screen.getAllByText(/months ago/);
      expect(monthsAgoElements.length).toBeGreaterThan(0);
    });

    it('handles recent dates correctly', () => {
      const recentCaseDetails: CaseDetails = {
        ...mockCaseDetails,
        lastUpdated: '2023-12-15T11:30:00Z', // 30 minutes ago
        priorityDate: '2023-12-14T12:00:00Z' // Yesterday
      };

      render(
        <CaseDetailsView 
          caseDetails={recentCaseDetails} 
          environment="production" 
        />
      );

      // The text appears in parentheses in the "Last Updated" section
      expect(screen.getByText(/30 minutes ago/)).toBeInTheDocument();
      expect(screen.getByText('Yesterday')).toBeInTheDocument();
    });

    it('handles invalid dates gracefully', () => {
      const invalidDateCaseDetails: CaseDetails = {
        ...mockCaseDetails,
        priorityDate: 'invalid-date',
        lastUpdated: 'also-invalid'
      };

      render(
        <CaseDetailsView 
          caseDetails={invalidDateCaseDetails} 
          environment="production" 
        />
      );

      // Should fallback to original strings (there are multiple instances)
      const invalidDateElements = screen.getAllByText('invalid-date');
      expect(invalidDateElements.length).toBeGreaterThan(0);
      expect(screen.getByText(/also-invalid/)).toBeInTheDocument();
    });
  });

  describe('Environment-Specific Behavior', () => {
    it('shows development mode indicator in development environment', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="development" 
        />
      );

      expect(screen.getByText(/Development Mode:/)).toBeInTheDocument();
      expect(screen.getByText(/Additional debug information available/)).toBeInTheDocument();
    });

    it('does not show development mode indicator in production', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="production" 
        />
      );

      expect(screen.queryByText(/Development Mode:/)).not.toBeInTheDocument();
    });

    it('does not show development mode indicator in staging', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="staging" 
        />
      );

      expect(screen.queryByText(/Development Mode:/)).not.toBeInTheDocument();
    });
  });

  describe('Approval Date Highlighting', () => {
    it('highlights approval date with green styling when present', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="production" 
        />
      );

      const approvalDateContainer = screen.getByText('August 19, 2023').closest('div');
      expect(approvalDateContainer).toHaveClass('bg-green-50', 'border-green-200');
      
      const approvalDateText = screen.getByText('August 19, 2023');
      expect(approvalDateText).toHaveClass('text-green-800');
    });

    it('does not show approval date section when not present', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetailsWithoutOptionalFields} 
          environment="production" 
        />
      );

      expect(screen.queryByText('Approval Date')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('renders with proper responsive classes', () => {
      const { container } = render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="production" 
        />
      );

      // Check for responsive grid classes
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-2');

      // Check for responsive flex classes
      const headerContainer = container.querySelector('.flex');
      expect(headerContainer).toHaveClass('sm:flex-row', 'sm:items-center', 'sm:justify-between');
    });
  });

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="production" 
        />
      );

      // Check for proper heading
      expect(screen.getByRole('heading', { name: 'Case Details' })).toBeInTheDocument();
      
      // Check for proper labels
      expect(screen.getByText('Processing Center')).toBeInTheDocument();
      expect(screen.getByText('Case Type')).toBeInTheDocument();
      expect(screen.getByText('Priority Date')).toBeInTheDocument();
    });

    it('has proper code element for verification ID', () => {
      render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="production" 
        />
      );

      const verificationCode = screen.getByText('VER-123456789');
      expect(verificationCode.tagName).toBe('CODE');
    });
  });
});