import { useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import type { Credentials, ProcessingResult } from './types';
import { useWasm } from './hooks/useWasm';
import { Menu } from './components/Menu';
import { CredentialForm } from './components/forms/CredentialForm';
import { ResultDisplay } from './components/ResultDisplay';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorBoundary } from './components/error/ErrorBoundary';
import { TokenCertification } from './components/TokenCertification';

type Page = 'credentials' | 'certification';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('credentials');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { isLoaded, error: wasmError, processCredentials, realtimeUpdates, clearRealtimeUpdates } = useWasm();

  const handleCredentialsSubmit = async (credentials: Credentials) => {
    if (!isLoaded) {
      toast.error('WASM module is not loaded yet. Please wait.');
      return;
    }

    setIsProcessing(true);
    setResult(null);
    console.log('Starting credential processing...');

    try {
      // Use the processCredentials function from the hook
      const response = await processCredentials(credentials);
      console.log('WASM Response:', response);

      if (response.success && response.result) {
        console.log('Setting result:', response.result);
        setResult(response.result);
        toast.success('Credentials processed successfully!');
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
    }
  };

  const handleReset = () => {
    setResult(null);
    toast.info('Form reset. Ready for new request.');
  };

  const handlePageChange = (page: Page) => {
    setCurrentPage(page);
    setResult(null);
    clearRealtimeUpdates();
  };

  // Show WASM loading error
  if (wasmError) {
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
            {wasmError}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Reload Page
          </button>
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
    console.log('Rendering page, current result:', result);
    switch (currentPage) {
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
                  <p className="text-gray-600">
                    Securely process your USCIS API credentials using WebAssembly
                  </p>
                </div>

                {/* Main Content */}
                <div className="space-y-8">
                  {!result ? (
                    /* Credential Form */
                    <div className="bg-white rounded-lg shadow-lg p-6">
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
                    <div>
                      <ResultDisplay
                        result={result}
                        onReset={handleReset}
                      />
                    </div>
                  )}

                  {/* Processing Indicator */}
                  {isProcessing && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <div className="text-center">
                        <LoadingSpinner
                          size="lg"
                          message="Processing your credentials..."
                          className="mb-4"
                        />
                        <p className="text-gray-600">
                          Please wait while we securely process your information...
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Realtime Updates */}
                  {realtimeUpdates.length > 0 && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Real-time Updates
                        </h3>
                        <button
                          onClick={clearRealtimeUpdates}
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {realtimeUpdates.map((update, index) => (
                          <div key={`${update.timestamp}-${index}`} className="text-sm bg-gray-50 p-3 rounded">
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-blue-600">
                                {update.type}
                              </span>
                              <span className="text-gray-500 text-xs">
                                {update.timestamp}
                              </span>
                            </div>
                            <pre className="mt-1 text-gray-700 whitespace-pre-wrap">
                              {JSON.stringify(update.data, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
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
