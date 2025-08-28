import { useState } from 'react';
import type { Environment, Credentials, FormErrors } from '../../types';
import { validateClientId, validateClientSecret } from '../../utils';
import { EnvironmentSelector } from './EnvironmentSelector';

interface CredentialFormProps {
  readonly onSubmit: (credentials: Credentials) => void;
  readonly isLoading?: boolean;
  readonly disabled?: boolean;
}

export function CredentialForm({
  onSubmit,
  isLoading = false,
  disabled = false
}: CredentialFormProps) {
  const [environment, setEnvironment] = useState<Environment>('development');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const validateField = (field: string, value: string) => {
    const newErrors = { ...errors };

    switch (field) {
      case 'clientId':
        if (!value.trim()) {
          newErrors.clientId = 'Client ID is required';
        } else {
          const validationError = validateClientId(value);
          if (validationError) {
            newErrors.clientId = validationError;
          } else {
            delete newErrors.clientId;
          }
        }
        break;
      case 'clientSecret':
        if (!value.trim()) {
          newErrors.clientSecret = 'Client Secret is required';
        } else {
          const validationError = validateClientSecret(value);
          if (validationError) {
            newErrors.clientSecret = validationError;
          } else {
            delete newErrors.clientSecret;
          }
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleFieldChange = (field: string, value: string) => {
    switch (field) {
      case 'clientId':
        setClientId(value);
        break;
      case 'clientSecret':
        setClientSecret(value);
        break;
    }

    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleFieldBlur = (field: string, value: string) => {
    setTouched({ ...touched, [field]: true });
    validateField(field, value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      clientId: true,
      clientSecret: true,
      environment: true
    });

    // Validate all fields synchronously
    const clientIdError = validateClientId(clientId);
    const clientSecretError = validateClientSecret(clientSecret);

    const newErrors: FormErrors = {};
    if (clientIdError) newErrors.clientId = clientIdError;
    if (clientSecretError) newErrors.clientSecret = clientSecretError;

    // Update errors state and check validation
    setErrors((prevErrors) => {
      const updatedErrors = { ...prevErrors, ...newErrors };
      
      // Check if there are any errors
      if (Object.keys(updatedErrors).length === 0 && clientId.trim() && clientSecret.trim()) {
        onSubmit({
          environment,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim()
        });
      }
      
      return updatedErrors;
    });
  };

  const isFormValid = clientId.trim() && clientSecret.trim() && Object.keys(errors).length === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <EnvironmentSelector
        value={environment}
        onChange={setEnvironment}
        error={touched.environment && errors.environment ? errors.environment : undefined}
        disabled={disabled || isLoading}
      />

      <div>
        <label
          htmlFor="client-id"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Client ID
        </label>
        <input
          id="client-id"
          type="text"
          value={clientId}
          onChange={(e) => handleFieldChange('clientId', e.target.value)}
          onBlur={(e) => handleFieldBlur('clientId', e.target.value)}
          disabled={disabled || isLoading}
          className={`w-full p-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.clientId && touched.clientId
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          } ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          placeholder="Enter your USCIS Client ID"
          autoComplete="off"
          spellCheck="false"
        />
        {errors.clientId && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.clientId}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="client-secret"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Client Secret
        </label>
        <input
          id="client-secret"
          type="password"
          value={clientSecret}
          onChange={(e) => handleFieldChange('clientSecret', e.target.value)}
          onBlur={(e) => handleFieldBlur('clientSecret', e.target.value)}
          disabled={disabled || isLoading}
          className={`w-full p-3 border rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            errors.clientSecret && touched.clientSecret
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 bg-white hover:border-gray-400'
          } ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          placeholder="Enter your USCIS Client Secret"
          autoComplete="off"
          spellCheck="false"
        />
        {errors.clientSecret && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {errors.clientSecret}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isFormValid || disabled || isLoading}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          isFormValid && !disabled && !isLoading
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Processing...
          </div>
        ) : (
          'Submit Credentials'
        )}
      </button>
    </form>
  );
}
