import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';

// Extend Jest matchers for accessibility testing
expect.extend(toHaveNoViolations);

// Configure testing library for better accessibility testing
configure({
  // Use accessible queries by default
  defaultHidden: false,
  
  // Increase timeout for accessibility checks
  asyncUtilTimeout: 5000,
  
  // Configure getBy* queries to be more accessible
  getElementError: (message) => {
    const error = new Error(message || 'Element not found');
    error.name = 'TestingLibraryElementError';
    return error;
  }
});

// Mock IntersectionObserver for components that use it
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  disconnect() { return; }
  observe() { return; }
  unobserve() { return; }
  takeRecords() { return []; }
};

// Mock ResizeObserver for responsive components
global.ResizeObserver = class ResizeObserver {
  disconnect() { return; }
  observe() { return; }
  unobserve() { return; }
};

// Mock matchMedia for responsive design testing
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock clipboard API for copy functionality testing
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
});

// Mock focus and blur methods for focus management testing
const originalFocus = HTMLElement.prototype.focus;
const originalBlur = HTMLElement.prototype.blur;

HTMLElement.prototype.focus = function(options) {
  // Track focus for testing
  this.setAttribute('data-focused', 'true');
  return originalFocus.call(this, options);
};

HTMLElement.prototype.blur = function() {
  // Track blur for testing
  this.removeAttribute('data-focused');
  return originalBlur.call(this);
};

// Mock screen reader announcements
const announcements: string[] = [];

// Mock aria-live region announcements
const originalSetAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function(name, value) {
  if (name === 'aria-live' && value !== 'off') {
    // Track live region updates
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const text = this.textContent?.trim();
          if (text) {
            announcements.push(text);
          }
        }
      });
    });
    
    observer.observe(this, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }
  
  return originalSetAttribute.call(this, name, value);
};

// Utility functions for accessibility testing
export const accessibilityTestUtils = {
  // Get all announcements made to screen readers
  getAnnouncements: () => [...announcements],
  
  // Clear announcement history
  clearAnnouncements: () => {
    announcements.length = 0;
  },
  
  // Check if element is properly focused
  isFocused: (element: HTMLElement) => {
    return document.activeElement === element && element.hasAttribute('data-focused');
  },
  
  // Get all focusable elements in container
  getFocusableElements: (container: HTMLElement) => {
    return container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
  },
  
  // Test tab order
  testTabOrder: async (container: HTMLElement) => {
    const focusableElements = accessibilityTestUtils.getFocusableElements(container);
    const tabOrder: HTMLElement[] = [];
    
    for (const element of focusableElements) {
      (element as HTMLElement).focus();
      tabOrder.push(document.activeElement as HTMLElement);
    }
    
    return tabOrder;
  },
  
  // Check color contrast (simplified mock)
  checkColorContrast: (element: HTMLElement) => {
    const style = window.getComputedStyle(element);
    const color = style.color;
    const backgroundColor = style.backgroundColor;
    
    // This is a simplified check - in real testing you'd use a proper contrast checker
    return {
      color,
      backgroundColor,
      hasGoodContrast: color !== backgroundColor // Simplified check
    };
  },
  
  // Check for proper ARIA attributes
  checkAriaAttributes: (element: HTMLElement) => {
    const ariaAttributes: Record<string, string> = {};
    
    for (const attr of element.attributes) {
      if (attr.name.startsWith('aria-')) {
        ariaAttributes[attr.name] = attr.value;
      }
    }
    
    return ariaAttributes;
  },
  
  // Check heading hierarchy
  checkHeadingHierarchy: (container: HTMLElement) => {
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    const hierarchy: { level: number; text: string; element: HTMLElement }[] = [];
    
    headings.forEach(heading => {
      const level = parseInt(heading.tagName.charAt(1));
      hierarchy.push({
        level,
        text: heading.textContent?.trim() || '',
        element: heading as HTMLElement
      });
    });
    
    return hierarchy;
  },
  
  // Check for landmark regions
  checkLandmarks: (container: HTMLElement) => {
    const landmarks = container.querySelectorAll(
      '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="region"], main, nav, header, footer, aside, section[aria-label], section[aria-labelledby]'
    );
    
    return Array.from(landmarks).map(landmark => ({
      role: landmark.getAttribute('role') || landmark.tagName.toLowerCase(),
      label: landmark.getAttribute('aria-label') || landmark.getAttribute('aria-labelledby'),
      element: landmark as HTMLElement
    }));
  },
  
  // Simulate screen reader navigation
  simulateScreenReaderNavigation: async (container: HTMLElement) => {
    const focusableElements = accessibilityTestUtils.getFocusableElements(container);
    const navigation: { element: HTMLElement; announcement: string }[] = [];
    
    for (const element of focusableElements) {
      (element as HTMLElement).focus();
      
      // Simulate what a screen reader would announce
      const role = element.getAttribute('role') || element.tagName.toLowerCase();
      const label = element.getAttribute('aria-label') || 
                   element.getAttribute('aria-labelledby') || 
                   element.textContent?.trim() || 
                   element.getAttribute('alt') || 
                   element.getAttribute('title');
      
      const announcement = `${role}${label ? ': ' + label : ''}`;
      navigation.push({ element: element as HTMLElement, announcement });
    }
    
    return navigation;
  }
};

// Global accessibility test configuration
export const accessibilityConfig = {
  // Default axe configuration
  axeConfig: {
    rules: {
      'color-contrast': { enabled: true },
      'keyboard-navigation': { enabled: true },
      'focus-management': { enabled: true },
      'aria-labels': { enabled: true },
      'semantic-markup': { enabled: true },
      'heading-order': { enabled: true },
      'landmark-roles': { enabled: true },
      'list-structure': { enabled: true },
      'form-labels': { enabled: true },
      'button-name': { enabled: true },
      'link-name': { enabled: true },
      'image-alt': { enabled: true },
      'bypass-blocks': { enabled: true },
      'page-has-heading-one': { enabled: true },
      'region': { enabled: true }
    },
    tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']
  },
  
  // Performance thresholds for accessibility tests
  performanceThresholds: {
    axeRunTime: 5000, // 5 seconds max for axe to run
    focusTime: 100,   // 100ms max for focus operations
    announceTime: 50  // 50ms max for announcements
  }
};

// Cleanup function for tests
export const cleanupAccessibilityTest = () => {
  accessibilityTestUtils.clearAnnouncements();
  
  // Reset focus
  if (document.activeElement && document.activeElement !== document.body) {
    (document.activeElement as HTMLElement).blur();
  }
  
  // Clear any data-focused attributes
  document.querySelectorAll('[data-focused]').forEach(element => {
    element.removeAttribute('data-focused');
  });
};

// Auto-cleanup after each test
afterEach(() => {
  cleanupAccessibilityTest();
});