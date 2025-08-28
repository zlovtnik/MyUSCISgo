import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CredentialForm } from '../components/forms/CredentialForm';

describe('CredentialForm', () => {
  const mockOnSubmit = vi.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders all form fields', () => {
    render(<CredentialForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/client secret/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/environment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit credentials/i })).toBeInTheDocument();
  });

  it('shows validation errors for empty required fields on submit', async () => {
    render(<CredentialForm onSubmit={mockOnSubmit} />);

    const submitButton = screen.getByRole('button', { name: /submit credentials/i });
    await user.click(submitButton);

    expect(await screen.findByText('Client ID is required')).toBeInTheDocument();
    expect(await screen.findByText('Client Secret is required')).toBeInTheDocument();

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates client ID field on blur', async () => {
    render(<CredentialForm onSubmit={mockOnSubmit} />);

    const clientIdInput = screen.getByLabelText(/client id/i);
    await user.type(clientIdInput, 'ab');
    await user.tab(); // Trigger blur

    await waitFor(() => {
      expect(screen.getByText('Client ID must be at least 3 characters')).toBeInTheDocument();
    });
  });

  it('validates client secret field on blur', async () => {
    render(<CredentialForm onSubmit={mockOnSubmit} />);

    const clientSecretInput = screen.getByLabelText(/client secret/i);
    await user.type(clientSecretInput, 'short');
    await user.tab(); // Trigger blur

    await waitFor(() => {
      expect(screen.getByText('Client secret must be at least 8 characters')).toBeInTheDocument();
    });
  });

  it('submits valid credentials', async () => {
    render(<CredentialForm onSubmit={mockOnSubmit} />);

    const clientIdInput = screen.getByLabelText(/client id/i);
    const clientSecretInput = screen.getByLabelText(/client secret/i);
    const submitButton = screen.getByRole('button', { name: /submit credentials/i });

    await user.type(clientIdInput, 'valid-client-123');
    await user.type(clientSecretInput, 'ValidSecret123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        clientId: 'valid-client-123',
        clientSecret: 'ValidSecret123',
        environment: 'development'
      });
    });
  });

  it('shows loading state when isLoading is true', () => {
    render(<CredentialForm onSubmit={mockOnSubmit} isLoading={true} />);

    const submitButton = screen.getByRole('button', { name: /processing/i });
    expect(submitButton).toBeDisabled();
  });

  it('disables form when disabled prop is true', () => {
    render(<CredentialForm onSubmit={mockOnSubmit} disabled={true} />);

    const clientIdInput = screen.getByLabelText(/client id/i);
    const clientSecretInput = screen.getByLabelText(/client secret/i);
    const submitButton = screen.getByRole('button', { name: /submit credentials/i });

    expect(clientIdInput).toBeDisabled();
    expect(clientSecretInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('changes environment selection', async () => {
    render(<CredentialForm onSubmit={mockOnSubmit} />);

    const environmentSelect = screen.getByLabelText(/environment/i);
    await user.selectOptions(environmentSelect, 'production');

    const clientIdInput = screen.getByLabelText(/client id/i);
    const clientSecretInput = screen.getByLabelText(/client secret/i);
    const submitButton = screen.getByRole('button', { name: /submit credentials/i });

    await user.type(clientIdInput, 'valid-client-123');
    await user.type(clientSecretInput, 'ValidSecret123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        clientId: 'valid-client-123',
        clientSecret: 'ValidSecret123',
        environment: 'production'
      });
    });
  });

  it('clears validation errors when user starts typing', async () => {
    render(<CredentialForm onSubmit={mockOnSubmit} />);

    const clientIdInput = screen.getByLabelText(/client id/i);
    const submitButton = screen.getByRole('button', { name: /submit credentials/i });

    // Trigger validation error
    await user.click(submitButton);
    expect(await screen.findByText('Client ID is required')).toBeInTheDocument();

    // Start typing
    await user.type(clientIdInput, 'valid-client');
    await waitFor(() => {
      expect(screen.queryByText('Client ID is required')).not.toBeInTheDocument();
    });
  });
});
