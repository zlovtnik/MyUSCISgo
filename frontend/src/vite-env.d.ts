/// <reference types="vite/client" />

interface GoInstance {
  importObject: WebAssembly.Imports;
  run: (instance: WebAssembly.Instance) => void;
}

interface GoProcessCredentialsResponse {
  success?: boolean;
  result?: Record<string, string>;
  error?: string;
}

declare global {
  interface Window {
    Go: new () => GoInstance;
    goProcessCredentials: (credentials: string) => GoProcessCredentialsResponse;
  }
}
