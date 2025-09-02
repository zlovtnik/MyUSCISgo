import { useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import { animations, presets } from './utils/animations';
import type { Credentials, ProcessingResult, Environment, ProcessingStep } from './types';
import { useWasm } from './hooks/useWasm';
import { Menu } from './components/Menu';
import type { Page } from './components/Menu';
import { CredentialForm } from './components/forms/CredentialForm';
import { ResultDisplay } from './components/ResultDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import { TokenCertification } from './components/TokenCertification';
import { ProcessingIndicator } from './components/ProcessingIndicator';
import { RealtimeUpdatesDisplay } from './components/RealtimeUpdatesDisplay';
import { EnvironmentIndicator } from './components/EnvironmentIndicator';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEnvironment, setCurrentEnvironment] = useState<Environment>('development');
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('validating');
  const [processingProgress, setProcessingProgress] = useState(0);
  const { isLoaded, error: wasmError, processCredentials, realtimeUpdates, clearRealtimeUpdates } = useWasm();

  const handleCredentialsSubmit = async (credentials: Credentials) => {
    if (!isLoaded) {
      toast.error('WASM module is not loaded yet. Please wait.');
      return;
    }

    // Store the current environment for use in ResultDisplay
    setCurrentEnvironment(credentials.environment);
    setIsProcessing(true);
    setResult(null);
    setCurrentStep('validating');
    setProcessingProgress(0);
    
    if (process.env.NODE_ENV !== 'production') console.debug('Starting credential processing...');

    try {
      // Simulate progress tracking through processing steps
      const steps: ProcessingStep[] = ['validating', 'authenticating', 'fetching-case-data', 'processing-results'];
      
      for (let i = 0; i < steps.length; i++) {
        setCurrentStep(steps[i]);
        setProcessingProgress(Math.round((i / steps.length) * 80)); // Leave 20% for completion
        
        // Small delay to show progress (in real implementation, this would be driven by WASM updates)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Use the processCredentials function from the hook
      const response = await processCredentials(credentials);
      if (process.env.NODE_ENV !== 'production') console.debug('WASM Response:', response);

      if (response.success && response.result) {
        setCurrentStep('complete');
        setProcessingProgress(100);
        
        // Validate the enhanced data structures
        const result = response.result;
        if (process.env.NODE_ENV !== 'production') {
          console.debug('Setting result:', result);
          
          // Log enhanced data if available
          if (result.caseDetails) {
            console.debug('Case Details:', result.caseDetails);
          }
          if (result.oauthToken) {
            console.debug('OAuth Token received (masked):', {
              tokenType: result.oauthToken.tokenType,
              expiresIn: result.oauthToken.expiresIn,
              scope: result.oauthToken.scope
            });
          }
          if (result.processingMetadata) {
            console.debug('Processing Metadata:', result.processingMetadata);
          }
        }
        
        setResult(result);
        
        // Enhanced success message based on available data
        let successMessage = 'Credentials processed successfully!';
        if (result.caseDetails) {
          successMessage += ` Case status: ${result.caseDetails.currentStatus}`;
        }
        toast.success(successMessage);
      } else {
        const errorMessage = response.error || 'Unknown error occurred';
        console.error('Processing failed:', errorMessage);
        toast.error(`Processing failed: ${errorMessage}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Processing error:', error);
      toast.error(`Unexpected error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      // Reset progress after a short delay to show completion
      setTimeout(() => {
        setProcessingProgress(0);
        setCurrentStep('validating');
      }, 2000);
    }
  };

  const handleReset = () => {
    setResult(null);
    setCurrentEnvironment('development'); // Reset to default environment
    setProcessingProgress(0);
    setCurrentStep('validating');
    setIsProcessing(false); // Ensure processing state is reset
    clearRealtimeUpdates();
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug('App state reset - ready for new request');
    }
    
    toast.info('Form reset. Ready for new request.');
  };

  const handleCancelProcessing = () => {
    setIsProcessing(false);
    setProcessingProgress(0);
    setCurrentStep('validating');
    toast.info('Processing cancelled.');
  };

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
    setResult(null);
    setIsProcessing(false); // Stop any ongoing processing
    setProcessingProgress(0);
    setCurrentStep('validating');
    clearRealtimeUpdates();
    
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`Page changed to: ${page}`);
    }
  };

  // Show WASM loading error with enhanced error handling
  if (wasmError) {
    const errorMessage = wasmError instanceof Error ? wasmError.message : String(wasmError);
    const isRetryable = wasmError instanceof Error && 'retryable' in wasmError && (wasmError as any).retryable;
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Failed to Load WASM Module
          </h2>
          <p className="text-gray-600 mb-4">
            {errorMessage}
          </p>
          <div className="space-y-2">
            {isRetryable && (
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Retry Loading
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Reload Page
            </button>
          </div>
          
          {/* Actionable guidance */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-left">
            <h3 className="text-sm font-medium text-blue-800 mb-1">What you can try:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Check your internet connection</li>
              <li>• Disable browser extensions</li>
              <li>• Try a different browser</li>
              <li>• Contact support if the problem persists</li>
            </ul>
          </div>
        </div>
        <ToastContainer />
      </div>
    );
  }

  // Show loading state while WASM is loading
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <LoadingSpinner
            size="lg"
            message="Loading WASM module..."
            className="mb-4"
          />
          <p className="text-gray-600">
            Initializing WebAssembly module. This may take a moment...
          </p>
        </div>
        <ToastContainer />
      </div>
    );
  }

  const renderCurrentPage = () => {
    if (process.env.NODE_ENV !== 'production') console.debug('Rendering page, current result:', result);
    switch (currentPage) {
      case 'home':
        return (
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
            <div className="container mx-auto px-4 py-16">
              <div className="max-w-6xl mx-auto text-center">
                {/* Hero Section */}
                <div className="mb-16">
                  <div className="inline-block p-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-8">
                    <span className="text-6xl">🚀</span>
                  </div>
                  <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                    Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">MyUSCISgo</span>
                  </h1>
                  <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
                    Secure, fast, and reliable USCIS API tools powered by WebAssembly.
                    Process your credentials and certify tokens with confidence.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => handlePageChange('credentials')}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-4 px-8 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      🔐 Start Processing Credentials
                    </button>
                    <button
                      onClick={() => handlePageChange('certification')}
                      className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-4 px-8 rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      ✅ Token Certification
                    </button>
                  </div>
                </div>

                {/* Features Section */}
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                  <div className="bg-white rounded-xl shadow-lg p-8 transform hover:scale-105 transition-all duration-200">
                    <div className="text-4xl mb-4">🔒</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Secure Processing</h3>
                    <p className="text-gray-600">
                      Your credentials are processed locally using WebAssembly. Nothing is stored on our servers.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg p-8 transform hover:scale-105 transition-all duration-200">
                    <div className="text-4xl mb-4">⚡</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Lightning Fast</h3>
                    <p className="text-gray-600">
                      Optimized performance with WebAssembly ensures quick processing and minimal wait times.
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-lg p-8 transform hover:scale-105 transition-all duration-200">
                    <div className="text-4xl mb-4">🛡️</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Privacy First</h3>
                    <p className="text-gray-600">
                      Your data stays on your device. We prioritize your privacy and security above all else.
                    </p>
                  </div>
                </div>

                {/* Call to Action */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
                  <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
                  <p className="text-xl mb-6 opacity-90">
                    Choose your tool and begin processing your USCIS data securely.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => handlePageChange('credentials')}
                      className="bg-white text-blue-600 hover:bg-gray-100 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                    >
                      Process Credentials →
                    </button>
                    <button
                      onClick={() => handlePageChange('certification')}
                      className="bg-white text-purple-600 hover:bg-gray-100 font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
                    >
                      Certify Tokens →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'credentials':
        return (
          <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-4 py-8">
              <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    USCIS Credential Processor
                  </h1>
                  <p className="text-gray-600 mb-4">
                    Securely process your USCIS API credentials using WebAssembly
                  </p>
                  
                  {/* Environment Indicator */}
                  <div className="flex justify-center">
                    <EnvironmentIndicator
                      environment={currentEnvironment}
                      processingMetadata={result?.processingMetadata}
                      showDebugInfo={currentEnvironment === 'development'}
                      className="text-left"
                    />
                  </div>
                </div>

                {/* Main Content */}
                <div className="space-y-8">
                  {!result ? (
                    /* Credential Form */
                    <div className={`bg-white rounded-lg shadow-lg p-6 ${animations.fadeIn} ${presets.card.hover}`}>
                      <h2 className="text-xl font-semibold text-gray-900 mb-6">
                        Enter Your Credentials
                      </h2>
                      <CredentialForm
                        onSubmit={handleCredentialsSubmit}
                        isLoading={isProcessing}
                        disabled={!isLoaded}
                      />
                    </div>
                  ) : (
                    /* Results Display */
                    <div className={animations.slideInFromBottom}>
                      <ResultDisplay
                        result={result}
                        onReset={handleReset}
                        environment={currentEnvironment}
                      />
                    </div>
                  )}

                  {/* Enhanced Processing Indicator */}
                  {isProcessing && (
                    <div className={`bg-white rounded-lg shadow-lg p-6 mb-6 ${animations.slideInFromTop} ${presets.card.hover}`}>
                      <ProcessingIndicator
                        isProcessing={isProcessing}
                        currentStep={currentStep}
                        progress={processingProgress}
                        realtimeUpdates={realtimeUpdates}
                        onCancel={handleCancelProcessing}
                      />
                    </div>
                  )}

                  {/* Enhanced Realtime Updates Display */}
                  {realtimeUpdates.length > 0 && (
                    <div className={`bg-white rounded-lg shadow-lg p-6 mb-6 ${animations.slideInFromLeft} ${presets.card.hover}`}>
                      <RealtimeUpdatesDisplay
                        updates={realtimeUpdates}
                        onClear={clearRealtimeUpdates}
                        isProcessing={isProcessing}
                      />
                    </div>
                  )}
                </div>
                <div className="mt-12 text-center text-sm text-gray-500">
                  <p>
                    Your credentials are processed securely using WebAssembly and are never stored on our servers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      case 'certification':
        return <TokenCertification />;
      default:
        return null;
    }
  };

  return (
    <>
      <Menu currentPage={currentPage} onPageChange={handlePageChange} />
      <div className="App">
        {renderCurrentPage()}

        {/* Toast Notifications */}
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="light"
        />
      </div>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
