import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TokenStatusView from '../components/results/TokenStatusView';
import { OAuthToken, Environment } from '../types';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

describe('TokenStatusView', () => {
  let mockToken: OAuthToken;
  
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Create a mock token that expires in 1 hour
    const futureDate = new Date(Date.now() + 60 * 60 * 1000);
    mockToken = {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      tokenType: 'Bearer',
      expiresIn: 3600,
      expiresAt: futureDate.toISOString(),
      scope: 'read write case:read'
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Rendering', () => {
    it('should render token status header', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByText('OAuth Token Status')).toBeInTheDocument();
    });

    it('should display masked access token', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      const maskedToken = screen.getByText('eyJh...sw5c');
      expect(maskedToken).toBeInTheDocument();
    });

    it('should display token type with description', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByText('Bearer')).toBeInTheDocument();
      expect(screen.getByText('Bearer token for API authentication')).toBeInTheDocument();
    });

    it('should display scope information', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByText('read write case:read')).toBeInTheDocument();
    });

    it('should display expiration time', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      const expirationDate = new Date(mockToken.expiresAt);
      expect(screen.getByText(expirationDate.toLocaleString())).toBeInTheDocument();
    });
  });

  describe('Token Validity Status', () => {
    it('should show valid status for non-expired token', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });

    it('should show expired status for expired token', () => {
      const expiredToken = {
        ...mockToken,
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };
      
      render(<TokenStatusView oauthToken={expiredToken} environment="development" />);
      
      expect(screen.getByText('Expired')).toBeInTheDocument();
      expect(screen.getByText('❌')).toBeInTheDocument();
      expect(screen.getByText('Token has expired')).toBeInTheDocument();
    });

    it('should show expiring soon status for token expiring within 30 minutes', () => {
      const soonExpiringToken = {
        ...mockToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
      };
      
      render(<TokenStatusView oauthToken={soonExpiringToken} environment="development" />);
      
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('should show low validity status for token expiring within 1 hour', () => {
      const lowValidityToken = {
        ...mockToken,
        expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString() // 45 minutes
      };
      
      render(<TokenStatusView oauthToken={lowValidityToken} environment="development" />);
      
      expect(screen.getByText('Valid (Low)')).toBeInTheDocument();
      expect(screen.getByText('⏰')).toBeInTheDocument();
    });
  });

  describe('Countdown Timer', () => {
    it('should display countdown timer that updates', async () => {
      const tokenExpiringIn5Seconds = {
        ...mockToken,
        expiresAt: new Date(Date.now() + 5000).toISOString()
      };
      
      render(<TokenStatusView oauthToken={tokenExpiringIn5Seconds} environment="development" />);
      
      // Should show 5 seconds initially
      expect(screen.getByText('5s')).toBeInTheDocument();
      
      // Advance time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      
      // Should now show 4 seconds
      expect(screen.getByText('4s')).toBeInTheDocument();
    });

    it('should format countdown with days, hours, minutes', () => {
      const tokenExpiringInDays = {
        ...mockToken,
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
      };
      
      render(<TokenStatusView oauthToken={tokenExpiringInDays} environment="development" />);
      
      expect(screen.getByText(/2d 3h 30m/)).toBeInTheDocument();
    });

    it('should handle countdown reaching zero', async () => {
      const tokenExpiringNow = {
        ...mockToken,
        expiresAt: new Date(Date.now() + 1000).toISOString()
      };
      
      render(<TokenStatusView oauthToken={tokenExpiringNow} environment="development" />);
      
      // Advance time past expiration
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      
      expect(screen.getByText('Token has expired')).toBeInTheDocument();
    });
  });

  describe('Token Type Descriptions', () => {
    it('should provide description for Bearer token', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByText('Bearer token for API authentication')).toBeInTheDocument();
    });

    it('should provide description for Basic token', () => {
      const basicToken = { ...mockToken, tokenType: 'Basic' };
      render(<TokenStatusView oauthToken={basicToken} environment="development" />);
      
      expect(screen.getByText('Basic authentication token')).toBeInTheDocument();
    });

    it('should provide generic description for unknown token type', () => {
      const customToken = { ...mockToken, tokenType: 'Custom' };
      render(<TokenStatusView oauthToken={customToken} environment="development" />);
      
      expect(screen.getByText('Custom authentication token')).toBeInTheDocument();
    });
  });

  describe('Scope Descriptions', () => {
    it('should describe known scopes', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByText(/Read access to resources, Write access to resources, Read case information/)).toBeInTheDocument();
    });

    it('should handle token without scope', () => {
      const tokenWithoutScope = { ...mockToken, scope: undefined };
      render(<TokenStatusView oauthToken={tokenWithoutScope} environment="development" />);
      
      expect(screen.getByText('Not specified')).toBeInTheDocument();
      expect(screen.getByText('No specific scope defined')).toBeInTheDocument();
    });

    it('should handle unknown scopes', () => {
      const tokenWithCustomScope = { ...mockToken, scope: 'custom:scope unknown:permission' };
      render(<TokenStatusView oauthToken={tokenWithCustomScope} environment="development" />);
      
      expect(screen.getByText('custom:scope, unknown:permission')).toBeInTheDocument();
    });
  });

  describe('Environment-specific Features', () => {
    it('should show debug info in development environment', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByText('Development Mode Debug Info')).toBeInTheDocument();
      expect(screen.getByText(/Full token length:/)).toBeInTheDocument();
      expect(screen.getByText(/Token starts with:/)).toBeInTheDocument();
    });

    it('should not show debug info in production environment', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="production" />);
      
      expect(screen.queryByText('Development Mode Debug Info')).not.toBeInTheDocument();
    });

    it('should not show debug info in staging environment', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="staging" />);
      
      expect(screen.queryByText('Development Mode Debug Info')).not.toBeInTheDocument();
    });
  });

  describe('Copy Functionality', () => {
    it('should copy full token when copy button is clicked', async () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      const copyButton = screen.getByTitle('Copy full token to clipboard');
      fireEvent.click(copyButton);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockToken.accessToken);
    });

    it('should copy token JSON when Copy Token JSON button is clicked', async () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      const copyJsonButton = screen.getByText('Copy Token JSON');
      fireEvent.click(copyJsonButton);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify(mockToken, null, 2)
      );
    });

    it('should copy token summary when Copy Token Summary button is clicked', async () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      const copySummaryButton = screen.getByText('Copy Token Summary');
      fireEvent.click(copySummaryButton);
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('"type": "Bearer"')
      );
    });
  });

  describe('Expired Token Actions', () => {
    it('should show refresh button for expired token', () => {
      const expiredToken = {
        ...mockToken,
        expiresAt: new Date(Date.now() - 1000).toISOString()
      };
      
      render(<TokenStatusView oauthToken={expiredToken} environment="development" />);
      
      expect(screen.getByText('Refresh Page to Re-authenticate')).toBeInTheDocument();
    });

    it('should not show refresh button for valid token', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.queryByText('Refresh Page to Re-authenticate')).not.toBeInTheDocument();
    });
  });

  describe('Token Masking', () => {
    it('should mask short tokens appropriately', () => {
      const shortToken = { ...mockToken, accessToken: 'short' };
      render(<TokenStatusView oauthToken={shortToken} environment="development" />);
      
      expect(screen.getByText('***')).toBeInTheDocument();
    });

    it('should mask long tokens showing first and last 4 characters', () => {
      const longToken = { ...mockToken, accessToken: 'abcdefghijklmnopqrstuvwxyz' };
      render(<TokenStatusView oauthToken={longToken} environment="development" />);
      
      expect(screen.getByText('abcd...wxyz')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for form elements', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByText('Access Token')).toBeInTheDocument();
      expect(screen.getByText('Token Type')).toBeInTheDocument();
      expect(screen.getByText('Scope')).toBeInTheDocument();
      expect(screen.getByText('Expiration Time')).toBeInTheDocument();
      expect(screen.getByText('Time Remaining')).toBeInTheDocument();
    });

    it('should have proper button titles for accessibility', () => {
      render(<TokenStatusView oauthToken={mockToken} environment="development" />);
      
      expect(screen.getByTitle('Copy full token to clipboard')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid date in expiresAt', () => {
      const invalidDateToken = { ...mockToken, expiresAt: 'invalid-date' };
      
      // Should not crash
      expect(() => {
        render(<TokenStatusView oauthToken={invalidDateToken} environment="development" />);
      }).not.toThrow();
    });

    it('should handle very long token gracefully', () => {
      const veryLongToken = { 
        ...mockToken, 
        accessToken: 'a'.repeat(1000) 
      };
      
      render(<TokenStatusView oauthToken={veryLongToken} environment="development" />);
      
      expect(screen.getByText('aaaa...aaaa')).toBeInTheDocument();
    });

    it('should handle empty scope gracefully', () => {
      const emptyScope = { ...mockToken, scope: '' };
      render(<TokenStatusView oauthToken={emptyScope} environment="development" />);
      
      expect(screen.getByText('Not specified')).toBeInTheDocument();
    });
  });
});