import { useState } from 'react';
import type { TokenCertificationResult, TokenCertificationData } from '../types';
import { useWasm } from '../hooks/useWasm';

interface TokenCertificationProps {
  readonly onSubmit?: (data: TokenCertificationData) => void;
}

interface FormErrors {
  token?: string;
  caseNumber?: string;
  general?: string;
}

export function TokenCertification({ onSubmit }: TokenCertificationProps) {
  const [formData, setFormData] = useState<TokenCertificationData>({
    token: '',
    caseNumber: '',
    environment: 'development'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [certificationResult, setCertificationResult] = useState<TokenCertificationResult | null>(null);

  const { certifyToken, isLoaded } = useWasm();

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.token.trim()) {
      newErrors.token = 'Token is required';
    }

    if (!formData.caseNumber.trim()) {
      newErrors.caseNumber = 'Case number is required';
    } else if (!/^[A-Z]{3}\d{10}$/.test(formData.caseNumber)) {
      newErrors.caseNumber = 'Case number must be in format: ABC1234567890';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setCertificationResult(null);

    try {
      console.log('Starting token certification for case:', formData.caseNumber);

      // Check if WASM is available
      if (!isLoaded) {
        throw new Error('WASM module not loaded. Please refresh the page.');
      }

      // Call the real WASM function
      const result = await certifyToken(formData);
      console.log('Token certification completed:', result);

      setCertificationResult(result);

      // Reset form on success
      setFormData({
        token: '',
        caseNumber: '',
        environment: 'development'
      });

      if (onSubmit) {
        onSubmit(formData);
      }

    } catch (error) {
      console.error('Certification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Certification failed. Please try again.';
      setErrors({ general: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };  const handleInputChange = (field: keyof FormErrors) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleReset = () => {
    setCertificationResult(null);
    setErrors({});
    setFormData({
      token: '',
      caseNumber: '',
      environment: 'development'
    });
  };

  const handleEnvironmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      environment: e.target.value as 'development' | 'production'
    }));
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Token Certification</h1>
          <p className="text-gray-600">
            Verify and certify USCIS API tokens for secure case processing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Environment Selection */}
          <div>
            <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-2">
              Environment
            </label>
            <select
              id="environment"
              value={formData.environment}
              onChange={handleEnvironmentChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="development">Development</option>
              <option value="production">Production</option>
            </select>
          </div>

          {/* Token Input */}
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
              API Token
            </label>
            <input
              type="password"
              id="token"
              value={formData.token}
              onChange={handleInputChange('token')}
              placeholder="Enter your USCIS API token"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.token ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.token && (
              <p className="mt-1 text-sm text-red-600">{errors.token}</p>
            )}
          </div>

          {/* Case Number Input */}
          <div>
            <label htmlFor="caseNumber" className="block text-sm font-medium text-gray-700 mb-2">
              USCIS Case Number
            </label>
            <input
              type="text"
              id="caseNumber"
              value={formData.caseNumber}
              onChange={handleInputChange('caseNumber')}
              placeholder="ABC1234567890"
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                errors.caseNumber ? 'border-red-500' : 'border-gray-300'
              }`}
              maxLength={13}
            />
            {errors.caseNumber && (
              <p className="mt-1 text-sm text-red-600">{errors.caseNumber}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Format: 3 letters followed by 10 digits (e.g., ABC1234567890)
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Certifying Token...
              </div>
            ) : (
              'Certify Token'
            )}
          </button>
        </form>

        {/* Certification Result */}
        {certificationResult && (
          <div className="mt-8 p-6 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center mb-4">
              <svg className="w-6 h-6 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h3 className="text-lg font-semibold text-green-800">Certification Successful</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg border border-green-200">
                <h4 className="font-medium text-gray-900 mb-2">Case Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Case Number:</span>
                    <span className="font-mono text-gray-900">{formData.caseNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-medium ${certificationResult.isValid ? 'text-green-600' : 'text-red-600'}`}>
                      {certificationResult.caseStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="text-gray-900">
                      {new Date(certificationResult.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Verification ID:</span>
                    <span className="font-mono text-gray-900 text-xs">
                      {certificationResult.verificationId}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg border border-green-200">
                <h4 className="font-medium text-gray-900 mb-2">Case Details</h4>
                <div className="space-y-2 text-sm">
                  {Object.entries(certificationResult.caseDetails).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">{key}:</span>
                      <span className="text-gray-900 text-right max-w-32 truncate" title={value}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm text-green-700">
                Token has been successfully certified and case information retrieved.
              </p>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                New Certification
              </button>
            </div>
          </div>
        )}

        {/* General Error Display */}
        {errors.general && (
          <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-700">{errors.general}</p>
            </div>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800 mb-1">Security Notice</h3>
              <p className="text-sm text-blue-700">
                Token certification is performed locally using WebAssembly. Your credentials are never sent to external servers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
