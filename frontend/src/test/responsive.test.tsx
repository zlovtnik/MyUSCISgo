import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CaseDetailsView } from '../components/results/CaseDetailsView';
import TokenStatusView from '../components/results/TokenStatusView';
import { ProcessingIndicator } from '../components/ProcessingIndicator';
import { ResultsContainer } from '../components/results/ResultsContainer';
import { EnvironmentIndicator } from '../components/EnvironmentIndicator';
import type { CaseDetails, OAuthToken, ProcessingResult, RealtimeUpdate } from '../types';

// Mock data
const mockCaseDetails: CaseDetails = {
    caseNumber: 'MSC2190000001',
    currentStatus: 'Case Was Approved',
    processingCenter: 'National Benefits Center',
    priorityDate: '2021-01-15',
    caseType: 'I-485 Application for Adjustment of Status',
    approvalDate: '2023-03-20',
    lastUpdated: '2023-03-21T10:30:00Z',
    verificationId: 'VER123456789'
};

const mockOAuthToken: OAuthToken = {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
    tokenType: 'Bearer',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    scope: 'read write'
};

const mockProcessingResult: ProcessingResult = {
    baseURL: 'https://api.uscis.gov',
    authMode: 'OAuth2',
    tokenHint: 'Bearer token authentication',
    config: {
        environment: 'development',
        version: '1.0.0',
        timeout: '30000'
    },
    caseDetails: mockCaseDetails,
    oauthToken: mockOAuthToken,
    processingMetadata: {
        environment: 'development',
        processingTime: 1500,
        requestId: 'req-123456',
        timestamp: new Date().toISOString()
    }
};

const mockRealtimeUpdates: RealtimeUpdate[] = [
    {
        id: '1',
        timestamp: new Date().toISOString(),
        step: 'validating',
        message: 'Validating credentials',
        level: 'info'
    }
];

// Utility function to simulate different viewport sizes
const setViewportSize = (width: number, height: number) => {
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
    });
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: height,
    });

    // Trigger resize event
    window.dispatchEvent(new Event('resize'));
};

describe('Responsive Design Tests', () => {
    beforeEach(() => {
        // Reset viewport to desktop size
        setViewportSize(1024, 768);
    });

    afterEach(() => {
        // Clean up any viewport changes
        setViewportSize(1024, 768);
    });

    describe('Mobile Viewport (320px - 640px)', () => {
        beforeEach(() => {
            setViewportSize(375, 667); // iPhone SE size
        });

        it('should render CaseDetailsView responsively on mobile', () => {
            const { container } = render(
                <CaseDetailsView
                    caseDetails={mockCaseDetails}
                    environment="development"
                />
            );

            const gridElements = container.querySelectorAll('[class*="lg:grid-cols-2"]');
            expect(gridElements.length).toBeGreaterThan(0);

            // Check for mobile-specific classes
            const mobileGridElements = container.querySelectorAll('.grid-cols-1');
            expect(mobileGridElements.length).toBeGreaterThan(0);

            // Check for responsive padding
            const paddingElements = container.querySelectorAll('.p-4');
            expect(paddingElements.length).toBeGreaterThan(0);
        });

        it('should stack elements vertically on mobile in TokenStatusView', () => {
            const { container } = render(
                <TokenStatusView
                    oauthToken={mockOAuthToken}
                    environment="development"
                />
            );

            // Check for flex-col classes for mobile stacking
            const flexColElements = container.querySelectorAll('.flex-col, .sm\\:flex-row');
            expect(flexColElements.length).toBeGreaterThan(0);
        });

it('should show abbreviated tab labels on mobile', () => {
    render(
        <ResultsContainer
            result={mockProcessingResult}
            environment="development"
            onReset={vi.fn()}
        />
    );

    // Check for mobile-specific tab label classes
    const hiddenElements = screen.getAllByText(/Case|Token|Config|Raw/);
    expect(hiddenElements.length).toBeGreaterThan(0);
});

        it('should have proper touch targets on mobile', () => {
            const { container } = render(
                <ProcessingIndicator
                    isProcessing={true}
                    currentStep="authenticating"
                    progress={50}
                    realtimeUpdates={mockRealtimeUpdates}
                    onCancel={vi.fn()}
                />
            );

            const buttons = container.querySelectorAll('button');
            buttons.forEach(button => {
                // Verify minimum touch target size (44x44px)
                const styles = window.getComputedStyle(button);
                const width = parseFloat(styles.width);
                const height = parseFloat(styles.height);
                expect(width).toBeGreaterThanOrEqual(44);
                expect(height).toBeGreaterThanOrEqual(44);
            });
        });

        it('should adjust step indicators for mobile', () => {
            const { container } = render(
                <ProcessingIndicator
                    isProcessing={true}
                    currentStep="authenticating"
                    progress={50}
                    realtimeUpdates={mockRealtimeUpdates}
                />
            );

            // Check for mobile-specific step indicator sizes
            const stepIndicators = container.querySelectorAll('[data-testid="step-indicator"]');
            stepIndicators.forEach(indicator => {
                expect(indicator).toHaveClass('w-8');
                expect(indicator).toHaveClass('h-8');
            });
        });
    });

    describe('Tablet Viewport (641px - 1024px)', () => {
        beforeEach(() => {
            setViewportSize(768, 1024); // iPad size
        });

        it('should use appropriate grid layouts on tablet', () => {
            const { container } = render(
                <CaseDetailsView
                    caseDetails={mockCaseDetails}
                    environment="development"
                />
            );

            // Should use lg:grid-cols-2 for larger screens
            const gridElements = container.querySelectorAll('.lg\\:grid-cols-2');
            expect(gridElements.length).toBeGreaterThan(0);
        });

        it('should show full tab labels on tablet', () => {
            render(
                <ResultsContainer
                    result={mockProcessingResult}
                    environment="development"
                    onReset={vi.fn()}
                />
            );

            // Full labels should be visible on larger screens (use getAllByText for multiple matches)
            expect(screen.getAllByText('Case Details').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Token Status').length).toBeGreaterThan(0);
        });

        it('should use appropriate spacing on tablet', () => {
            const { container } = render(
                <TokenStatusView
                    oauthToken={mockOAuthToken}
                    environment="development"
                />
            );

            // Check for tablet-specific spacing classes
            const spacingElements = container.querySelectorAll('[class*="sm:space"], [class*="sm:gap"]');
            expect(spacingElements.length).toBeGreaterThan(0);
        });
    });

    describe('Desktop Viewport (1025px+)', () => {
        beforeEach(() => {
            setViewportSize(1440, 900); // Desktop size
        });

        it('should use full grid layouts on desktop', () => {
            const { container } = render(
                <CaseDetailsView
                    caseDetails={mockCaseDetails}
                    environment="development"
                />
            );

            // Should use full grid layouts
            const gridElements = container.querySelectorAll('.lg\\:grid-cols-2');
            expect(gridElements.length).toBeGreaterThan(0);
        });

        it('should show all content without truncation on desktop', () => {
            render(
                <ResultsContainer
                    result={mockProcessingResult}
                    environment="development"
                    onReset={vi.fn()}
                />
            );

            // All tab labels should be fully visible (use getAllByText for multiple matches)
            expect(screen.getAllByText('Case Details').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Token Status').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Configuration').length).toBeGreaterThan(0);
            expect(screen.getAllByText('Raw Data').length).toBeGreaterThan(0);
        });

        it('should use optimal spacing and padding on desktop', () => {
            const { container } = render(
                <ProcessingIndicator
                    isProcessing={true}
                    currentStep="authenticating"
                    progress={50}
                    realtimeUpdates={mockRealtimeUpdates}
                />
            );

            // Check for desktop-specific padding
            const paddingElements = container.querySelectorAll('.sm\\:p-6');
            expect(paddingElements.length).toBeGreaterThan(0);
        });
    });

    describe('Breakpoint Transitions', () => {
        it('should handle viewport changes gracefully', () => {
            const { container, rerender } = render(
                <CaseDetailsView
                    caseDetails={mockCaseDetails}
                    environment="development"
                />
            );

            // Start with mobile
            setViewportSize(375, 667);
            rerender(
                <CaseDetailsView
                    caseDetails={mockCaseDetails}
                    environment="development"
                />
            );

            expect(container.firstChild).toBeInTheDocument();

            // Switch to desktop
            setViewportSize(1440, 900);
            rerender(
                <CaseDetailsView
                    caseDetails={mockCaseDetails}
                    environment="development"
                />
            );

            expect(container.firstChild).toBeInTheDocument();
        });

        it('should maintain functionality across breakpoints', () => {
            const onReset = vi.fn();

            render(
                <ResultsContainer
                    result={mockProcessingResult}
                    environment="development"
                    onReset={onReset}
                />
            );

            // Test on mobile
            setViewportSize(375, 667);
            const resetButton = screen.getByRole('button', { name: /new request/i });
            expect(resetButton).toBeInTheDocument();

            // Test on desktop
            setViewportSize(1440, 900);
            expect(resetButton).toBeInTheDocument();
        });
    });

    describe('Text and Content Scaling', () => {
        it('should use appropriate text sizes for different viewports', () => {
            const { container } = render(
                <CaseDetailsView
                    caseDetails={mockCaseDetails}
                    environment="development"
                />
            );

            // Check for responsive text classes
            const textElements = container.querySelectorAll('.text-sm, .sm\\:text-lg, .text-xs');
            expect(textElements.length).toBeGreaterThan(0);
        });

        it('should handle long text content appropriately', () => {
            const longCaseDetails: CaseDetails = {
                ...mockCaseDetails,
                processingCenter: 'Very Long Processing Center Name That Should Wrap Appropriately',
                caseType: 'Very Long Case Type Description That Should Handle Wrapping Gracefully'
            };

            const { container } = render(
                <CaseDetailsView
                    caseDetails={longCaseDetails}
                    environment="development"
                />
            );

            // Check for break-all classes for long text
            const breakElements = container.querySelectorAll('.break-all');
            expect(breakElements.length).toBeGreaterThan(0);
        });
    });

    describe('Interactive Elements Responsiveness', () => {
        it('should maintain button accessibility across viewports', () => {
            const { container } = render(
                <TokenStatusView
                    oauthToken={mockOAuthToken}
                    environment="development"
                />
            );

            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button).toBeInTheDocument();
                expect(button).toHaveAttribute('type', 'button');
            });

            // Should have responsive button classes
            expect(container.querySelector('[class*="sm:"]')).toBeInTheDocument();
        });

        it('should handle tab navigation responsively', () => {
            render(
                <ResultsContainer
                    result={mockProcessingResult}
                    environment="development"
                    onReset={vi.fn()}
                />
            );

            const tabs = screen.getAllByRole('tab');
            expect(tabs.length).toBeGreaterThan(0);

            // Tabs should be scrollable on mobile
            const tabList = screen.getByRole('tablist');
            expect(tabList).toHaveClass('overflow-x-auto');
        });
    });
            const minimalCaseDetails: CaseDetails = {
                caseNumber: 'MSC2190000001',
                currentStatus: 'Pending',
                processingCenter: 'NBC',
                priorityDate: '2021-01-15',
                caseType: 'I-485',
                lastUpdated: '2023-03-21T10:30:00Z'
            };

            render(
                <CaseDetailsView
                    caseDetails={minimalCaseDetails}
                    environment="production"
                />
            );

            expect(screen.getByText('Pending')).toBeInTheDocument();
            expect(screen.getByText('NBC')).toBeInTheDocument();
        });

        it('should adapt to different content lengths', () => {
            const shortResult: ProcessingResult = {
                baseURL: 'https://api.gov',
                authMode: 'OAuth',
                tokenHint: 'Token',
                config: { env: 'prod' }
            };

            render(
                <ResultsContainer
                    result={shortResult}
                    environment="production"
                    onReset={vi.fn()}
                />
            );

            // Should still render properly with minimal content
            expect(screen.getByText('Processing Results')).toBeInTheDocument();
        });
    });

    describe('Performance Considerations', () => {
        it('should not render unnecessary elements on mobile', () => {
            setViewportSize(375, 667);

            const { container } = render(
                <EnvironmentIndicator
                    environment="development"
                    showDebugInfo={true}
                />
            );

            // Debug info should still be present but may be styled differently
            expect(container.firstChild).toBeInTheDocument();
        });

        it('should handle large datasets responsively', () => {
            const largeConfig = Object.fromEntries(
                Array.from({ length: 20 }, (_, i) => [`config${i}`, `value${i}`])
            );

            const largeResult: ProcessingResult = {
                ...mockProcessingResult,
                config: largeConfig
            };

            render(
                <ResultsContainer
                    result={largeResult}
                    environment="development"
                    onReset={vi.fn()}
                />
            );

            // Should handle large config objects
            expect(screen.getByText('Processing Results')).toBeInTheDocument();
        });
    });
});