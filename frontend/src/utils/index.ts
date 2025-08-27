import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function validateClientId(value: string): string | null {
  if (!value.trim()) {
    return 'Client ID is required';
  }

  if (value.length < 3) {
    return 'Client ID must be at least 3 characters';
  }

  if (value.length > 100) {
    return 'Client ID must be less than 100 characters';
  }

  if (!/^[a-zA-Z0-9-]+$/.test(value)) {
    return 'Client ID must contain only alphanumeric characters and hyphens';
  }

  return null;
}

export function validateClientSecret(value: string): string | null {
  if (!value) {
    return 'Client secret is required';
  }

  if (value.length < 8) {
    return 'Client secret must be at least 8 characters';
  }

  if (value.length > 255) {
    return 'Client secret must be less than 255 characters';
  }

  // Check for basic complexity
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasNumber = /\d/.test(value);

  if (!hasLetter || !hasNumber) {
    return 'Client secret must contain at least one letter and one number';
  }

  return null;
}

export function formatJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
