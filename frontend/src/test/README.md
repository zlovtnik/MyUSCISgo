# Comprehensive Test Suite Documentation

This directory contains a comprehensive test suite for the frontend application, covering all aspects of functionality, performance, accessibility, and user experience.

## Test Structure

### Test Categories

1. **Unit Tests** (`*.test.ts`, `*.test.tsx`)
   - Individual component testing
   - Utility function testing
   - Hook testing
   - Data transformation testing

2. **Integration Tests** (`integration.*.test.ts`)
   - WASM integration testing
   - Component interaction testing
   - Data flow validation
   - End-to-end component workflows

3. **Performance Tests** (`performance.test.ts`)
   - Rendering performance
   - Memory usage testing
   - Large dataset handling
   - User interaction responsiveness

4. **Accessibility Tests** (`accessibility.*.test.tsx`)
   - WCAG 2.1 AA compliance
   - Screen reader compatibility
   - Keyboard navigation
   - Focus management
   - Color contrast validation

5. **E2E Tests** (`tests/e2e/*.spec.ts`)
   - Complete user workflows
   - Cross-browser testing
   - Mobile responsiveness
   - Visual regression testing

## Running Tests

### Individual Test Categories

```bash
# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# Accessibility tests
npm run test:accessibility

# E2E tests
npm run test:e2e

# E2E workflow tests
npm run test:e2e:workflows

# Visual regression tests
npm run test:e2e:visual
```

### Comprehensive Testing

```bash
# All unit/integration/performance/accessibility tests
npm run test:all

# Everything including E2E
npm run test:comprehensive

# CI pipeline tests
npm run test:ci
```

### Development Testing

```bash
# Watch mode for unit tests
npm run test:watch:unit

# Interactive test UI
npm run test:ui

# E2E with UI
npm run test:e2e:ui

# Coverage report
npm run test:coverage
```

## Test Files Overview

### Core Test Files

- `setup.ts` - Test environment setup and mocks
- `accessibility-setup.ts` - Accessibility testing configuration
- `test-runner.config.ts` - Test runner configuration and utilities

### Unit Test Files

- `CaseDetailsView.test.tsx` - Case details component testing
- `TokenStatusView.test.tsx` - Token status component testing
- `ProcessingIndicator.test.tsx` - Processing indicator testing
- `ResultsContainer.test.tsx` - Results container testing
- `EnvironmentIndicator.test.tsx` - Environment indicator testing
- `CredentialForm.test.tsx` - Form component testing
- `ErrorBoundary.test.tsx` - Error boundary testing
- `useWasm.test.ts` - WASM hook testing
- `useWasm.enhanced.test.ts` - Enhanced WASM functionality
- `useWasm.errorHandling.test.ts` - WASM error handling
- `dataTransform.test.ts` - Data transformation utilities
- `formatting.test.ts` - Formatting utilities
- `validation.test.ts` - Validation utilities
- `security.test.ts` - Security utilities
- `errorHandling.test.ts` - Error handling utilities

### Integration Test Files

- `integration.wasm.test.ts` - Complete WASM integration testing

### Performance Test Files

- `performance.test.ts` - Comprehensive performance testing

### Accessibility Test Files

- `accessibility.test.tsx` - Basic accessibility testing
- `accessibility.enhanced.test.tsx` - Comprehensive accessibility testing

### E2E Test Files

- `app.spec.ts` - Basic application E2E tests
- `workflows.spec.ts` - Complete user workflow testing
- `visual.spec.ts` - Visual regression testing

## Test Data and Mocks

### Mock Data Generators

The test suite includes comprehensive mock data generators:

```typescript
// Generate mock WASM responses of different sizes
generateMockWASMResponse('small' | 'medium' | 'large')

// Generate mock credentials
generateMockCredentials(valid: boolean)

// Generate mock errors
generateMockError('validation' | 'network' | 'processing')
```

### Worker Mocking

All tests use a comprehensive Worker mock that simulates:
- Message passing
- Event handling
- Error scenarios
- Timeout situations
- Real-time updates

## Performance Testing

### Performance Thresholds

The test suite enforces performance thresholds:

- Component rendering: < 100ms
- User interactions: < 50ms
- Data transformation: < 50ms
- Form submission: < 500ms
- Large dataset handling: < 200ms

### Memory Testing

Tests monitor memory usage for:
- Component rendering with large datasets
- Real-time update handling
- Resource cleanup on unmount

## Accessibility Testing

### WCAG Compliance

Tests ensure compliance with:
- WCAG 2.1 AA standards
- Section 508 requirements
- Best practices for web accessibility

### Testing Areas

- **Keyboard Navigation**: Tab order, arrow keys, Enter/Space activation
- **Screen Reader Support**: ARIA labels, live regions, semantic markup
- **Focus Management**: Focus trapping, focus restoration, visible focus indicators
- **Color Contrast**: Sufficient contrast ratios, no color-only information
- **Form Accessibility**: Label associations, error announcements, required field indication

### Accessibility Utilities

```typescript
// Check element focus state
accessibilityTestUtils.isFocused(element)

// Test tab order
accessibilityTestUtils.testTabOrder(container)

// Check ARIA attributes
accessibilityTestUtils.checkAriaAttributes(element)

// Validate heading hierarchy
accessibilityTestUtils.checkHeadingHierarchy(container)

// Simulate screen reader navigation
accessibilityTestUtils.simulateScreenReaderNavigation(container)
```

## Visual Regression Testing

### Screenshot Categories

- Initial application states
- Processing states
- Results displays
- Error states
- Responsive layouts (desktop, tablet, mobile)
- Environment-specific styling
- Dark mode variations
- High contrast mode

### Screenshot Naming Convention

Screenshots follow the pattern: `{category}-{state}-{variant}.png`

Examples:
- `initial-layout.png`
- `processing-state.png`
- `results-complete.png`
- `mobile-layout.png`
- `dark-mode-results.png`

## E2E Testing

### Test Scenarios

1. **Complete User Workflows**
   - Credential submission to results
   - Environment switching
   - Error handling and recovery
   - Tab navigation through results

2. **Accessibility Workflows**
   - Complete keyboard navigation
   - Screen reader simulation
   - Focus management

3. **Performance Workflows**
   - Rapid form submissions
   - Large dataset handling
   - UI responsiveness

4. **Mobile Workflows**
   - Touch interactions
   - Mobile-specific layouts
   - Responsive behavior

### Browser Coverage

E2E tests run on:
- Chromium (Desktop)
- Firefox (Desktop)
- WebKit/Safari (Desktop)
- Mobile Chrome
- Mobile Safari

## Test Configuration

### Environment Variables

```bash
# Test environment
NODE_ENV=test

# Coverage thresholds
COVERAGE_THRESHOLD=80

# Test timeouts
TEST_TIMEOUT=10000
E2E_TIMEOUT=30000

# Performance thresholds
RENDER_THRESHOLD=100
INTERACTION_THRESHOLD=50
```

### CI/CD Integration

The test suite is designed for CI/CD integration with:
- Parallel test execution
- Test result reporting
- Coverage reporting
- Visual regression detection
- Performance regression detection

## Debugging Tests

### Debug Modes

```bash
# Debug E2E tests
npm run test:e2e:debug

# Debug with headed browser
playwright test --headed

# Debug specific test
vitest run --reporter=verbose specific.test.ts

# Debug with UI
npm run test:ui
```

### Common Issues

1. **WASM Loading**: Ensure WASM mock is properly initialized
2. **Timing Issues**: Use proper waitFor patterns
3. **Focus Management**: Check focus state before assertions
4. **Memory Leaks**: Verify proper cleanup in afterEach hooks

## Best Practices

### Writing Tests

1. **Descriptive Names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow AAA pattern
3. **Single Responsibility**: One assertion per test when possible
4. **Proper Cleanup**: Always clean up resources
5. **Mock Appropriately**: Mock external dependencies, not internal logic

### Performance Testing

1. **Realistic Data**: Use realistic data sizes
2. **Multiple Runs**: Average results over multiple runs
3. **Baseline Comparison**: Compare against established baselines
4. **Environment Consistency**: Run in consistent environments

### Accessibility Testing

1. **Real User Simulation**: Test like real users with disabilities
2. **Multiple Methods**: Use both automated and manual testing
3. **Progressive Enhancement**: Test with and without JavaScript
4. **Assistive Technology**: Test with actual screen readers when possible

## Maintenance

### Regular Tasks

1. **Update Dependencies**: Keep testing libraries up to date
2. **Review Thresholds**: Adjust performance thresholds as needed
3. **Update Screenshots**: Refresh visual regression baselines
4. **Clean Test Data**: Remove obsolete test data and mocks

### Monitoring

1. **Test Performance**: Monitor test execution times
2. **Flaky Tests**: Identify and fix unstable tests
3. **Coverage Trends**: Track coverage over time
4. **Accessibility Compliance**: Regular accessibility audits

## Contributing

When adding new features:

1. **Add Unit Tests**: Test individual components and functions
2. **Add Integration Tests**: Test component interactions
3. **Update E2E Tests**: Add new user workflows
4. **Check Accessibility**: Ensure new features are accessible
5. **Performance Impact**: Test performance impact of changes
6. **Visual Changes**: Update visual regression tests if needed

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [axe-core Documentation](https://github.com/dequelabs/axe-core)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)