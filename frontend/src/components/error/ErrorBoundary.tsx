import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

// Enhanced error types for better categorization
export type ErrorCategory = 
  | 'wasm-initialization'
  | 'wasm-processing'
  | 'wasm-timeout'
  | 'network'
  | 'validation'
  | 'authentication'
  | 'token-refresh'
  | 'component'
  | 'unknown';

export interface EnhancedError extends Error {
  category?: ErrorCategory;
  retryable?: boolean;
  userMessage?: string;
  technicalDetails?: string;
  context?: Record<string, any>;
}

export class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Enhance error with additional context
    const enhancedError = this.enhanceError(error, errorInfo);

    this.setState({
      error: enhancedError,
      errorInfo,
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(enhancedError, errorInfo);
    }

    // Report error for monitoring (in production, this would go to a service)
    this.reportError(enhancedError, errorInfo);
  }

  private enhanceError(error: Error, errorInfo: ErrorInfo): EnhancedError {
    const enhancedError = error as EnhancedError;
    
    // Categorize error based on message and stack
    enhancedError.category = this.categorizeError(error);
    enhancedError.retryable = this.isRetryableError(error);
    enhancedError.userMessage = this.getUserFriendlyMessage(error);
    enhancedError.technicalDetails = error.message;
    enhancedError.context = {
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount
    };

    return enhancedError;
  }

  private categorizeError(error: Error): ErrorCategory {
    // Check if it's already an enhanced error with a category
    if ('category' in error && (error as EnhancedError).category) {
      return (error as EnhancedError).category;
    }

    // Check error name first (for typed errors)
    if (error.name === 'WASMError') {
      const wasmError = error as any;
      if (wasmError.operation === 'initialize') {
        return 'wasm-initialization';
      }
      if (error.message.toLowerCase().includes('timeout')) {
        return 'wasm-timeout';
      }
      return 'wasm-processing';
    }

    if (error.name === 'NetworkError') {
      return 'network';
    }

    if (error.name === 'ValidationError') {
      return 'validation';
    }

    if (error.name === 'TokenRefreshError') {
      return 'token-refresh';
    }

    // Fallback to message-based categorization
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('wasm') || message.includes('webassembly')) {
      if (message.includes('timeout') || message.includes('request timeout')) {
        return 'wasm-timeout';
      }
      if (message.includes('not loaded') || message.includes('initialization')) {
        return 'wasm-initialization';
      }
      return 'wasm-processing';
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return 'network';
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation';
    }

    if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
      if (message.includes('refresh') || message.includes('expired')) {
        return 'token-refresh';
      }
      return 'authentication';
    }

    if (stack.includes('react') || stack.includes('component')) {
      return 'component';
    }

    return 'unknown';
  }

  private isRetryableError(error: Error): boolean {
    // Check if it's already an enhanced error with retryable property
    if ('retryable' in error && typeof (error as EnhancedError).retryable === 'boolean') {
      return (error as EnhancedError).retryable && this.state.retryCount < this.maxRetries;
    }

    // Check typed errors
    if (error.name === 'WASMError') {
      const wasmError = error as any;
      return (wasmError.retryable !== false) && this.state.retryCount < this.maxRetries;
    }

    if (error.name === 'ValidationError') {
      return false; // Validation errors are never retryable
    }

    // Fallback to category-based logic
    const category = this.categorizeError(error);
    const retryableCategories: ErrorCategory[] = [
      'wasm-timeout',
      'network',
      'token-refresh',
      'wasm-processing'
    ];
    
    return retryableCategories.includes(category) && this.state.retryCount < this.maxRetries;
  }

  private getUserFriendlyMessage(error: Error): string {
    const category = this.categorizeError(error);
    
    switch (category) {
      case 'wasm-initialization':
        return 'Failed to initialize the application. Please refresh the page and try again.';
      case 'wasm-processing':
        return 'There was an error processing your request. Please try again or check your credentials.';
      case 'wasm-timeout':
        return 'The request timed out. Please try again with a stable internet connection.';
      case 'network':
        return 'Network connection error. Please check your internet connection and try again.';
      case 'validation':
        return 'Invalid input detected. Please check your credentials and try again.';
      case 'authentication':
        return 'Authentication failed. Please verify your credentials and try again.';
      case 'token-refresh':
        return 'Session expired. Please re-enter your credentials.';
      case 'component':
        return 'A component error occurred. Please refresh the page.';
      default:
        return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
    }
  }

  private reportError(error: EnhancedError, errorInfo: ErrorInfo) {
    // In production, this would send to an error monitoring service
    if (import.meta.env.DEV) {
      console.group('🚨 Error Report');
      console.error('Error:', error);
      console.error('Category:', error.category);
      console.error('Retryable:', error.retryable);
      console.error('User Message:', error.userMessage);
      console.error('Context:', error.context);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1
    }));

    // Call the onRetry callback if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error as EnhancedError;
      const canRetry = error?.retryable && this.state.retryCount < this.maxRetries;

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-red-500">
                {this.getErrorIcon(error?.category)}
              </div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                {this.getErrorTitle(error?.category)}
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {error?.userMessage || 'An unexpected error occurred. Please try refreshing the page.'}
              </p>
              
              {this.state.retryCount > 0 && (
                <p className="mt-2 text-center text-xs text-gray-500">
                  Retry attempt {this.state.retryCount} of {this.maxRetries}
                </p>
              )}
            </div>

            <div className="space-y-4">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Retry ({this.maxRetries - this.state.retryCount} attempts left)
                </button>
              )}

              <button
                onClick={this.handleReset}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Reset Application
              </button>

              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Refresh Page
              </button>
            </div>

            {this.renderActionableGuidance(error?.category)}

            {import.meta.env.DEV && error && (
              <details className="mt-8 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="space-y-2 text-xs text-red-800">
                    <div><strong>Category:</strong> {error.category}</div>
                    <div><strong>Retryable:</strong> {error.retryable ? 'Yes' : 'No'}</div>
                    <div><strong>Technical Details:</strong> {error.technicalDetails}</div>
                    {error.context && (
                      <div>
                        <strong>Context:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(error.context, null, 2)}</pre>
                      </div>
                    )}
                    <div>
                      <strong>Stack Trace:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>
                    </div>
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="mt-1 whitespace-pre-wrap">{this.state.errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }

  private getErrorIcon(category?: ErrorCategory) {
    switch (category) {
      case 'wasm-initialization':
      case 'wasm-processing':
        return (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'network':
        return (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        );
      case 'authentication':
      case 'token-refresh':
        return (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      default:
        return (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
    }
  }

  private getErrorTitle(category?: ErrorCategory): string {
    switch (category) {
      case 'wasm-initialization':
        return 'Initialization Failed';
      case 'wasm-processing':
        return 'Processing Error';
      case 'wasm-timeout':
        return 'Request Timeout';
      case 'network':
        return 'Connection Error';
      case 'validation':
        return 'Validation Error';
      case 'authentication':
        return 'Authentication Failed';
      case 'token-refresh':
        return 'Session Expired';
      case 'component':
        return 'Component Error';
      default:
        return 'Something went wrong';
    }
  }

  private renderActionableGuidance(category?: ErrorCategory) {
    const guidance = this.getActionableGuidance(category);
    if (!guidance) return null;

    return (
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="text-sm font-medium text-blue-800 mb-2">What you can do:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          {guidance.map((item, index) => (
            <li key={index} className="flex items-start">
              <span className="mr-2">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  private getActionableGuidance(category?: ErrorCategory): string[] | null {
    switch (category) {
      case 'wasm-initialization':
        return [
          'Refresh the page to reload the WebAssembly module',
          'Check if your browser supports WebAssembly',
          'Disable browser extensions that might block WebAssembly'
        ];
      case 'wasm-processing':
        return [
          'Verify your credentials are correct',
          'Check your internet connection',
          'Try again in a few moments'
        ];
      case 'wasm-timeout':
        return [
          'Check your internet connection stability',
          'Try again with a faster connection',
          'Contact support if timeouts persist'
        ];
      case 'network':
        return [
          'Check your internet connection',
          'Verify you can access other websites',
          'Try again in a few moments'
        ];
      case 'validation':
        return [
          'Double-check your Client ID format',
          'Verify your Client Secret is correct',
          'Ensure you selected the right environment'
        ];
      case 'authentication':
        return [
          'Verify your Client ID and Secret are correct',
          'Check if your credentials are active',
          'Contact your administrator if credentials are valid'
        ];
      case 'token-refresh':
        return [
          'Re-enter your credentials',
          'Check if your account is still active',
          'Contact support if the problem persists'
        ];
      default:
        return [
          'Try refreshing the page',
          'Check your internet connection',
          'Contact support if the problem continues'
        ];
    }
  }
}

// Hook version for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);
    // In a real application, you might want to send this to an error reporting service
    // reportError(error, errorInfo);
  };
}
