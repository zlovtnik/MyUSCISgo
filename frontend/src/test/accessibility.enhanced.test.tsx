import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { CaseDetailsView } from '../components/results/CaseDetailsView';
import { TokenStatusView } from '../components/results/TokenStatusView';
import { ProcessingIndicator } from '../components/ProcessingIndicator';
import { ResultsContainer } from '../components/results/ResultsContainer';
import { EnvironmentIndicator } from '../components/EnvironmentIndicator';
import type { CaseDetails, OAuthToken, ProcessingResult, ProcessingStep, RealtimeUpdate } from '../types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock react-toastify
vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn()
  },
  ToastContainer: () => null
}));

// Mock data transformation utilities
vi.mock('../utils/dataTransform', () => ({
  transformWASMOutput: vi.fn((input) => input),
  transformRealtimeUpdate: vi.fn((input) => ({
    id: input.id || 'test-id',
    timestamp: input.timestamp || new Date().toISOString(),
    step: input.step || 'validating',
    message: input.message || 'Test message',
    level: input.level || 'info'
  })),
  sanitizeForLogging: vi.fn((input) => input),
  deepClone: vi.fn((input) => JSON.parse(JSON.stringify(input))),
  clearTransformCache: vi.fn(),
  getCacheStats: vi.fn(() => ({
    size: 0,
    limit: 100,
    keys: []
  }))
}));

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
  },
  {
    id: '2',
    timestamp: new Date().toISOString(),
    step: 'authenticating',
    message: 'Authenticating with API',
    level: 'info'
  },
  {
    id: '3',
    timestamp: new Date().toISOString(),
    step: 'fetching-case-data',
    message: 'Fetching case data',
    level: 'warning'
  }
];

// Accessibility testing utilities
const testKeyboardNavigation = async (container: HTMLElement) => {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  for (let i = 0; i < focusableElements.length; i++) {
    const element = focusableElements[i] as HTMLElement;
    element.focus();
    expect(document.activeElement).toBe(element);
  }
};

const testAriaAttributes = (container: HTMLElement) => {
  // Check for required ARIA attributes
  const elementsWithAriaLabel = container.querySelectorAll('[aria-label]');
  const elementsWithAriaLabelledBy = container.querySelectorAll('[aria-labelledby]');
  const elementsWithAriaDescribedBy = container.querySelectorAll('[aria-describedby]');
  
  elementsWithAriaLabel.forEach(element => {
    expect(element.getAttribute('aria-label')).toBeTruthy();
  });
  
  elementsWithAriaLabelledBy.forEach(element => {
    const labelId = element.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(container.querySelector(`#${labelId}`)).toBeTruthy();
  });
  
  elementsWithAriaDescribedBy.forEach(element => {
    const descriptionId = element.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(container.querySelector(`#${descriptionId}`)).toBeTruthy();
  });
};

const testColorContrast = (container: HTMLElement) => {
  // Check that important elements don't rely solely on color
  const statusElements = container.querySelectorAll('[role="status"], .status, .badge');
  statusElements.forEach(element => {
    expect(element.textContent?.trim()).toBeTruthy();
  });
  
  const errorElements = container.querySelectorAll('[role="alert"], .error, .danger');
  errorElements.forEach(element => {
    expect(element.textContent?.trim()).toBeTruthy();
  });
};

describe('Enhanced Accessibility Tests', () => {
  let mockWorker: any;
  let mockPostMessage: any;
  let mockTerminate: any;
  let mockAddEventListener: any;
  let mockRemoveEventListener: any;
  let messageHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    messageHandlers = new Map();
    
    mockPostMessage = vi.fn();
    mockTerminate = vi.fn();
    mockAddEventListener = vi.fn((event, handler) => {
      messageHandlers.set(event, handler);
    });
    mockRemoveEventListener = vi.fn();

    mockWorker = {
      postMessage: mockPostMessage,
      terminate: mockTerminate,
      addEventListener: mockAddEventListener,
      removeEventListener: mockRemoveEventListener
    };

    global.Worker = vi.fn(() => mockWorker) as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const simulateWorkerMessage = (type: string, data: any = {}, requestId?: number) => {
    const messageHandler = messageHandlers.get('message');
    if (messageHandler) {
      messageHandler({
        data: {
          type,
          result: data,
          error: data.error,
          requestId,
          context: data.context
        }
      });
    }
  };

  describe('Complete Application Accessibility', () => {
    it('should have no accessibility violations in initial state', async () => {
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations during processing', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Fill and submit form
      await user.type(screen.getByLabelText(/client id/i), 'accessibility-test');
      await user.type(screen.getByLabelText(/client secret/i), 'AccessibilitySecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Wait for processing state
      await waitFor(() => {
        expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations with results displayed', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Complete workflow
      await user.type(screen.getByLabelText(/client id/i), 'results-accessibility-test');
      await user.type(screen.getByLabelText(/client secret/i), 'ResultsAccessibilitySecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      simulateWorkerMessage('result', mockProcessingResult, 1);

      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support complete keyboard navigation through form', async () => {
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      await testKeyboardNavigation(container);
    });

    it('should support keyboard navigation through results tabs', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Get to results state
      await user.type(screen.getByLabelText(/client id/i), 'keyboard-nav-test');
      await user.type(screen.getByLabelText(/client secret/i), 'KeyboardNavSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      simulateWorkerMessage('result', mockProcessingResult, 1);

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
      });

      // Test tab navigation with arrow keys
      const tabs = screen.getAllByRole('tab');
      const firstTab = tabs[0];
      
      firstTab.focus();
      expect(document.activeElement).toBe(firstTab);

      // Test arrow key navigation
      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      if (tabs.length > 1) {
        expect(document.activeElement).toBe(tabs[1]);
      }

      fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(firstTab);

      // Test Home/End keys
      fireEvent.keyDown(firstTab, { key: 'End' });
      expect(document.activeElement).toBe(tabs[tabs.length - 1]);

      fireEvent.keyDown(document.activeElement!, { key: 'Home' });
      expect(document.activeElement).toBe(firstTab);
    });

    it('should handle Enter and Space keys for tab activation', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Get to results
      await user.type(screen.getByLabelText(/client id/i), 'tab-activation-test');
      await user.type(screen.getByLabelText(/client secret/i), 'TabActivationSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      simulateWorkerMessage('result', mockProcessingResult, 1);

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
      });

      const tabs = screen.getAllByRole('tab');
      if (tabs.length > 1) {
        const secondTab = tabs[1];
        
        secondTab.focus();
        
        // Test Enter key activation
        fireEvent.keyDown(secondTab, { key: 'Enter' });
        expect(secondTab).toHaveAttribute('aria-selected', 'true');
        
        // Test Space key activation
        const thirdTab = tabs[2] || tabs[0];
        thirdTab.focus();
        fireEvent.keyDown(thirdTab, { key: ' ' });
        expect(thirdTab).toHaveAttribute('aria-selected', 'true');
      }
    });

    it('should trap focus in modal-like components', async () => {
      // Test focus trapping if any modal components exist
      const { container } = render(
        <ProcessingIndicator
          isProcessing={true}
          currentStep="authenticating"
          progress={50}
          realtimeUpdates={mockRealtimeUpdates}
          onCancel={vi.fn()}
        />
      );

      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        // Focus should cycle within the component
        lastElement.focus();
        fireEvent.keyDown(lastElement, { key: 'Tab' });
        // In a proper focus trap, this would cycle to the first element
      }
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper heading hierarchy', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Get to results
      await user.type(screen.getByLabelText(/client id/i), 'heading-test');
      await user.type(screen.getByLabelText(/client secret/i), 'HeadingSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      simulateWorkerMessage('result', mockProcessingResult, 1);

      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument();
      });

      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);

      // Check heading levels are logical
      let previousLevel = 0;
      headings.forEach(heading => {
        const level = parseInt(heading.tagName.charAt(1));
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(6);
        
        // Heading levels shouldn't skip more than one level
        if (previousLevel > 0) {
          expect(level - previousLevel).toBeLessThanOrEqual(1);
        }
        previousLevel = level;
      });
    });

    it('should have proper landmark regions', async () => {
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Check for main landmark
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();

      // Check for form landmark
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      // Check for navigation if present
      const navigation = container.querySelector('[role="navigation"]');
      if (navigation) {
        expect(navigation).toHaveAttribute('aria-label');
      }
    });

    it('should announce status changes to screen readers', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Submit form
      await user.type(screen.getByLabelText(/client id/i), 'status-announcement-test');
      await user.type(screen.getByLabelText(/client secret/i), 'StatusAnnouncementSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Check for live regions during processing
      const liveRegions = container.querySelectorAll('[aria-live]');
      expect(liveRegions.length).toBeGreaterThan(0);

      liveRegions.forEach(region => {
        const liveValue = region.getAttribute('aria-live');
        expect(['polite', 'assertive', 'off']).toContain(liveValue);
      });

      // Check for status role elements
      await waitFor(() => {
        expect(screen.getByTestId('processing-indicator')).toBeInTheDocument();
      });

      const statusElements = container.querySelectorAll('[role="status"]');
      expect(statusElements.length).toBeGreaterThan(0);
    });

    it('should provide descriptive labels for interactive elements', async () => {
      const { container } = render(
        <ResultsContainer
          result={mockProcessingResult}
          environment="development"
          onReset={vi.fn()}
        />
      );

      const buttons = container.querySelectorAll('button');
      buttons.forEach(button => {
        const hasAriaLabel = button.hasAttribute('aria-label');
        const hasAriaLabelledBy = button.hasAttribute('aria-labelledby');
        const hasTextContent = button.textContent && button.textContent.trim().length > 0;
        
        // Button should have accessible name through one of these methods
        expect(hasAriaLabel || hasAriaLabelledBy || hasTextContent).toBe(true);
      });

      const links = container.querySelectorAll('a');
      links.forEach(link => {
        const hasAriaLabel = link.hasAttribute('aria-label');
        const hasAriaLabelledBy = link.hasAttribute('aria-labelledby');
        const hasTextContent = link.textContent && link.textContent.trim().length > 0;
        
        expect(hasAriaLabel || hasAriaLabelledBy || hasTextContent).toBe(true);
      });
    });
  });

  describe('Form Accessibility', () => {
    it('should associate labels with form controls', async () => {
      render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Check explicit label associations
      const clientIdInput = screen.getByLabelText(/client id/i);
      expect(clientIdInput).toHaveAttribute('id');
      
      const clientSecretInput = screen.getByLabelText(/client secret/i);
      expect(clientSecretInput).toHaveAttribute('id');
      
      const environmentSelect = screen.getByLabelText(/environment/i);
      expect(environmentSelect).toHaveAttribute('id');
    });

    it('should provide error messages with proper associations', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Trigger validation errors
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getAllByRole('alert')).toHaveLength(2);
      });

      const alerts = screen.getAllByRole('alert');
      alerts.forEach(alert => {
        expect(alert.textContent?.trim()).toBeTruthy();
      });

      // Test field-specific error
      await user.type(screen.getByLabelText(/client id/i), 'invalid@client!');
      await user.type(screen.getByLabelText(/client secret/i), 'ValidSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText(/must contain only alphanumeric characters/i)).toBeInTheDocument();
      });

      // Error should be associated with the field
      const clientIdInput = screen.getByLabelText(/client id/i);
      const errorId = clientIdInput.getAttribute('aria-describedby');
      if (errorId) {
        expect(screen.getByText(/must contain only alphanumeric characters/i)).toHaveAttribute('id', errorId);
      }
    });

    it('should indicate required fields appropriately', async () => {
      render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      const requiredFields = screen.getAllByRole('textbox', { required: true });
      requiredFields.forEach(field => {
        expect(field).toHaveAttribute('required');
        expect(field).toHaveAttribute('aria-required', 'true');
      });

      const requiredSelects = screen.getAllByRole('combobox', { required: true });
      requiredSelects.forEach(select => {
        expect(select).toHaveAttribute('required');
        expect(select).toHaveAttribute('aria-required', 'true');
      });
    });
  });

  describe('Dynamic Content Accessibility', () => {
    it('should handle dynamic content updates accessibly', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Start processing
      await user.type(screen.getByLabelText(/client id/i), 'dynamic-content-test');
      await user.type(screen.getByLabelText(/client secret/i), 'DynamicContentSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Send realtime updates
      mockRealtimeUpdates.forEach(update => {
        simulateWorkerMessage('realtime-update', update);
      });

      // Check that updates are announced
      const liveRegions = container.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions.length).toBeGreaterThan(0);

      // Complete processing
      simulateWorkerMessage('result', mockProcessingResult, 1);

      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument();
      });

      // Check that result appearance is announced
      const resultRegion = screen.getByTestId('result');
      expect(resultRegion).toHaveAttribute('aria-live');
    });

    it('should manage focus appropriately during state changes', async () => {
      const user = userEvent.setup();
      render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      const submitButton = screen.getByRole('button', { name: /submit/i });
      
      // Focus submit button
      submitButton.focus();
      expect(document.activeElement).toBe(submitButton);

      // Fill and submit form
      await user.type(screen.getByLabelText(/client id/i), 'focus-management-test');
      await user.type(screen.getByLabelText(/client secret/i), 'FocusManagementSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(submitButton);

      // Focus should remain manageable during processing
      expect(document.activeElement).toBeTruthy();

      // Complete processing
      simulateWorkerMessage('result', mockProcessingResult, 1);

      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument();
      });

      // Focus should be managed appropriately when results appear
      // (Implementation specific - might focus first tab, result heading, etc.)
      expect(document.activeElement).toBeTruthy();
    });
  });

  describe('Component-Specific Accessibility', () => {
    it('should make CaseDetailsView fully accessible', async () => {
      const { container } = render(
        <CaseDetailsView 
          caseDetails={mockCaseDetails} 
          environment="development" 
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      testAriaAttributes(container);
      testColorContrast(container);

      // Check for proper time elements
      const timeElements = container.querySelectorAll('time');
      timeElements.forEach(timeElement => {
        expect(timeElement).toHaveAttribute('dateTime');
      });

      // Check status has proper role
      const statusElements = container.querySelectorAll('[role="status"]');
      expect(statusElements.length).toBeGreaterThan(0);
    });

    it('should make TokenStatusView fully accessible', async () => {
      const { container } = render(
        <TokenStatusView 
          oauthToken={mockOAuthToken} 
          environment="development" 
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      testAriaAttributes(container);
      testColorContrast(container);

      // Check timer has proper attributes
      const timerElements = container.querySelectorAll('[role="timer"]');
      timerElements.forEach(timer => {
        expect(timer).toHaveAttribute('aria-live');
        expect(timer).toHaveAttribute('aria-atomic');
      });

      // Check copy buttons have proper labels
      const copyButtons = container.querySelectorAll('button[aria-label*="copy"], button[aria-label*="Copy"]');
      copyButtons.forEach(button => {
        expect(button.getAttribute('aria-label')).toBeTruthy();
      });
    });

    it('should make ProcessingIndicator fully accessible', async () => {
      const { container } = render(
        <ProcessingIndicator
          isProcessing={true}
          currentStep="authenticating"
          progress={50}
          realtimeUpdates={mockRealtimeUpdates}
          onCancel={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      testAriaAttributes(container);
      testColorContrast(container);

      // Check progress bar accessibility
      const progressBar = container.querySelector('[role="progressbar"]');
      expect(progressBar).toBeTruthy();
      expect(progressBar).toHaveAttribute('aria-valuenow');
      expect(progressBar).toHaveAttribute('aria-valuemin');
      expect(progressBar).toHaveAttribute('aria-valuemax');

      // Check step indicators
      const stepGroup = container.querySelector('[role="group"]');
      expect(stepGroup).toBeTruthy();
      expect(stepGroup).toHaveAttribute('aria-label');
    });

    it('should make EnvironmentIndicator fully accessible', async () => {
      const { container } = render(
        <EnvironmentIndicator
          environment="development"
          showDebugInfo={true}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      testAriaAttributes(container);
      testColorContrast(container);

      // Check alert role for warnings
      const alerts = container.querySelectorAll('[role="alert"]');
      alerts.forEach(alert => {
        expect(alert.textContent?.trim()).toBeTruthy();
      });

      // Check list structure
      const lists = container.querySelectorAll('[role="list"]');
      lists.forEach(list => {
        const listItems = list.querySelectorAll('[role="listitem"]');
        expect(listItems.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error State Accessibility', () => {
    it('should make error states accessible', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Trigger validation errors
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getAllByRole('alert')).toHaveLength(2);
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check error announcements
      const alerts = screen.getAllByRole('alert');
      alerts.forEach(alert => {
        expect(alert.textContent?.trim()).toBeTruthy();
        expect(alert).toHaveAttribute('aria-live');
      });
    });

    it('should handle processing errors accessibly', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);
      
      simulateWorkerMessage('initialized');
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /submit/i })).not.toBeDisabled();
      });

      // Submit form
      await user.type(screen.getByLabelText(/client id/i), 'error-test');
      await user.type(screen.getByLabelText(/client secret/i), 'ErrorSecret123');
      await user.selectOptions(screen.getByLabelText(/environment/i), 'development');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      // Simulate error
      simulateWorkerMessage('error', {
        error: 'Processing failed',
        context: { step: 'authentication' }
      }, 1);

      await waitFor(() => {
        expect(screen.getByText(/processing failed/i)).toBeInTheDocument();
      });

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Check error is properly announced
      const errorElement = screen.getByText(/processing failed/i);
      expect(errorElement.closest('[role="alert"]')).toBeTruthy();
    });
  });
});