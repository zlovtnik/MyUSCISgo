
import type { Environment, ProcessingMetadata } from '../types';
import { ENVIRONMENTS } from '../types';
import { cn } from '../utils';

interface EnvironmentIndicatorProps {
  environment: Environment;
  processingMetadata?: ProcessingMetadata;
  showDebugInfo?: boolean;
  className?: string;
}

interface DebugInfo {
  buildMode: string;
  timestamp: string;
  userAgent: string;
  viewport: string;
  wasmSupported: boolean;
}

export function EnvironmentIndicator({
  environment,
  processingMetadata,
  showDebugInfo = false,
  className
}: EnvironmentIndicatorProps) {
  const envConfig = ENVIRONMENTS.find(env => env.value === environment);
  
  if (!envConfig) {
    return null;
  }

  const getDebugInfo = (): DebugInfo => ({
    buildMode: process.env.NODE_ENV || 'unknown',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    wasmSupported: typeof WebAssembly !== 'undefined'
  });

  const getEnvironmentIcon = () => {
    switch (environment) {
      case 'development':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      case 'staging':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'production':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getEnvironmentMessage = () => {
    switch (environment) {
      case 'development':
        return 'Debug features enabled • Mock data available • Extended logging active';
      case 'staging':
        return 'Test environment • Production-like settings • Validation warnings enabled';
      case 'production':
        return 'Live environment • Full security enabled • Optimized performance';
      default:
        return envConfig.description;
    }
  };

  const getFeatureIndicators = () => {
    const features: string[] = [];
    
    switch (environment) {
      case 'development':
        features.push('Debug Mode', 'Mock Data', 'Hot Reload', 'Dev Tools');
        break;
      case 'staging':
        features.push('Test Mode', 'Validation', 'Monitoring', 'Pre-prod');
        break;
      case 'production':
        features.push('Live Data', 'Security', 'Performance', 'Monitoring');
        break;
    }
    
    return features;
  };

  const debugInfo = showDebugInfo && environment === 'development' ? getDebugInfo() : null;

  return (
    <div 
      className={cn("space-y-3", className)}
      role="region"
      aria-labelledby="environment-heading"
    >
      {/* Main Environment Badge */}
      <div className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium",
        envConfig.color
      )}>
        <span aria-hidden="true">{getEnvironmentIcon()}</span>
        <span id="environment-heading">{envConfig.label} Environment</span>
      </div>

      {/* Environment Message */}
      <div 
        className="text-sm text-gray-600"
        aria-describedby="environment-heading"
      >
        {getEnvironmentMessage()}
      </div>

      {/* Feature Indicators */}
      <div 
        className="flex flex-wrap gap-2"
        role="list"
        aria-label="Environment features"
      >
        {getFeatureIndicators().map((feature) => (
          <span
            key={feature}
            className={cn(
              "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
              environment === 'development' && "bg-blue-50 text-blue-700 border border-blue-200",
              environment === 'staging' && "bg-yellow-50 text-yellow-700 border border-yellow-200",
              environment === 'production' && "bg-green-50 text-green-700 border border-green-200"
            )}
            role="listitem"
          >
            {feature}
          </span>
        ))}
      </div>

      {/* Processing Metadata */}
      {processingMetadata && (
        <div 
          className="bg-gray-50 rounded-lg p-3 space-y-2"
          role="region"
          aria-labelledby="processing-info-heading"
        >
          <h4 
            id="processing-info-heading"
            className="text-sm font-medium text-gray-900"
          >
            Processing Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600">
            <div>
              <span className="font-medium">Request ID:</span>
              <span 
                className="ml-1 font-mono break-all"
                aria-label={`Request ID: ${processingMetadata.requestId}`}
              >
                {processingMetadata.requestId}
              </span>
            </div>
            <div>
              <span className="font-medium">Processing Time:</span>
              <span className="ml-1">{processingMetadata.processingTime}ms</span>
            </div>
            <div className="sm:col-span-2">
              <span className="font-medium">Timestamp:</span>
              <time 
                className="ml-1"
                dateTime={processingMetadata.timestamp}
              >
                {new Date(processingMetadata.timestamp).toLocaleString()}
              </time>
            </div>
          </div>
        </div>
      )}

      {/* Debug Information (Development Only) */}
      {debugInfo && (
        <div 
          className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2"
          role="region"
          aria-labelledby="debug-info-heading"
        >
          <div className="flex items-center gap-2">
            <svg 
              className="w-4 h-4 text-blue-600" 
              fill="currentColor" 
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <h4 
              id="debug-info-heading"
              className="text-sm font-medium text-blue-900"
            >
              Debug Information
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs text-blue-800">
            <div>
              <span className="font-medium">Build Mode:</span>
              <span className="ml-1 font-mono">{debugInfo.buildMode}</span>
            </div>
            <div>
              <span className="font-medium">Viewport:</span>
              <span className="ml-1 font-mono">{debugInfo.viewport}</span>
            </div>
            <div>
              <span className="font-medium">WASM Support:</span>
              <span 
                className={cn(
                  "ml-1 px-1 rounded text-xs",
                  debugInfo.wasmSupported 
                    ? "bg-green-100 text-green-800" 
                    : "bg-red-100 text-red-800"
                )}
                role="status"
                aria-label={`WebAssembly support: ${debugInfo.wasmSupported ? 'Available' : 'Not available'}`}
              >
                {debugInfo.wasmSupported ? 'Supported' : 'Not Supported'}
              </span>
            </div>
            <div>
              <span className="font-medium">User Agent:</span>
              <span 
                className="ml-1 font-mono text-xs break-all"
                title={debugInfo.userAgent}
              >
                {debugInfo.userAgent}
              </span>
            </div>
            <div>
              <span className="font-medium">Debug Timestamp:</span>
              <time 
                className="ml-1 font-mono"
                dateTime={debugInfo.timestamp}
              >
                {debugInfo.timestamp}
              </time>
            </div>
          </div>
        </div>
      )}

      {/* Environment-Specific Warnings */}
      {environment === 'development' && (
        <div 
          className="bg-amber-50 border border-amber-200 rounded-lg p-3"
          role="alert"
          aria-labelledby="dev-warning-heading"
        >
          <div className="flex items-start gap-2">
            <svg 
              className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-amber-800">
              <p 
                id="dev-warning-heading"
                className="font-medium"
              >
                Development Mode Active
              </p>
              <p className="mt-1">This environment includes debug features and may use mock data. Do not use for production testing.</p>
            </div>
          </div>
        </div>
      )}

      {environment === 'staging' && (
        <div 
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
          role="alert"
          aria-labelledby="staging-warning-heading"
        >
          <div className="flex items-start gap-2">
            <svg 
              className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" 
              fill="currentColor" 
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="text-sm text-yellow-800">
              <p 
                id="staging-warning-heading"
                className="font-medium"
              >
                Staging Environment
              </p>
              <p className="mt-1">This is a test environment with production-like settings. Data may be reset periodically.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}