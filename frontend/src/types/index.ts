export interface Credentials {
  clientId: string;
  clientSecret: string;
  environment: Environment;
}

export interface ProcessingResult {
  baseURL: string;
  authMode: string;
  tokenHint: string;
  config: Record<string, string>;
}

export interface WASMResponse {
  success: boolean;
  result?: ProcessingResult;
  error?: string;
}

export type Environment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  value: Environment;
  label: string;
  description: string;
  color: string;
}

export const ENVIRONMENTS: EnvironmentConfig[] = [
  {
    value: 'development',
    label: 'Development',
    description: 'Local development environment with debug features enabled',
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  {
    value: 'staging',
    label: 'Staging',
    description: 'Testing environment with production-like settings',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  },
  {
    value: 'production',
    label: 'Production',
    description: 'Live production environment with full security',
    color: 'bg-red-100 text-red-800 border-red-200'
  }
];

export interface FormErrors {
  clientId?: string;
  clientSecret?: string;
  environment?: string;
  general?: string;
}

export interface FormState {
  clientId: string;
  clientSecret: string;
  environment: Environment;
  errors: FormErrors;
  isSubmitting: boolean;
  isValid: boolean;
}
