package security

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"MyUSCISgo/pkg/types"
)

// OAuthToken represents an OAuth 2.0 access token
type OAuthToken struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresIn   int       `json:"expires_in"`
	ExpiresAt   time.Time `json:"expires_at"`
	Scope       string    `json:"scope,omitempty"`
}

// IsExpired checks if the OAuth token has expired
func (t *OAuthToken) IsExpired() bool {
	return time.Now().After(t.ExpiresAt)
}

// HashSecret creates a temporary, time-salted hash of the client secret for transient processing.
// NOTE: Non-deterministic by design; do NOT persist or compare across calls.
func HashSecret(secret string) string {
	// Add a timestamp salt to make it time-sensitive
	salt := fmt.Sprintf("%d", time.Now().UnixNano())
	data := secret + salt

	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

// GenerateSecureToken generates a secure token for the given client ID
func GenerateSecureToken(clientID string) (string, error) {
	// Create a random nonce
	nonce := make([]byte, 16)
	if _, err := rand.Read(nonce); err != nil {
		return "", fmt.Errorf("failed to generate random nonce: %w", err)
	}

	// Combine client ID with nonce and timestamp
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	data := clientID + hex.EncodeToString(nonce) + timestamp

	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:]), nil
}

// GenerateOAuthToken generates a mock OAuth token for USCIS API
// In production, this would make an actual OAuth request to USCIS
func GenerateOAuthToken(ctx context.Context, clientID, clientSecret string) (*OAuthToken, error) {
	// Check if context is cancelled
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// For now, generate a mock token (will be replaced with real USCIS client)
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Create token with expiration (1 hour from now)
	expiresAt := time.Now().Add(time.Hour)

	token := &OAuthToken{
		AccessToken: hex.EncodeToString(tokenBytes),
		TokenType:   "Bearer",
		ExpiresIn:   3600, // 1 hour in seconds
		ExpiresAt:   expiresAt,
		Scope:       "case-status:read",
	}

	return token, nil
}

// RefreshOAuthToken refreshes an expired OAuth token
// In production, this would make a refresh token request to USCIS
func RefreshOAuthToken(ctx context.Context, clientID, clientSecret, refreshToken string) (*OAuthToken, error) {
	// For now, generate a new token (in production, use refresh token)
	return GenerateOAuthToken(ctx, clientID, clientSecret)
}

// ValidateOAuthToken validates an OAuth token format and expiration
// TODO: Consider injecting time.Now via a var to test edge cases (skew, near-expiry)
func ValidateOAuthToken(token *OAuthToken) error {
	if token == nil {
		return fmt.Errorf("token is nil")
	}

	if token.AccessToken == "" {
		return fmt.Errorf("access token is empty")
	}

	if token.IsExpired() {
		return fmt.Errorf("token has expired")
	}

	if token.TokenType != "Bearer" {
		return fmt.Errorf("unsupported token type: %s", token.TokenType)
	}

	return nil
}

// ValidateSecretFormat performs additional security checks on the secret
func ValidateSecretFormat(secret string) error {
	// Check for common weak patterns
	weakPatterns := []string{
		"password", "123456", "admin", "secret",
		"qwerty", "letmein", "welcome", "monkey",
	}

	lowerSecret := strings.ToLower(secret)
	for _, pattern := range weakPatterns {
		if strings.Contains(lowerSecret, pattern) {
			return fmt.Errorf("client secret contains common weak pattern")
		}
	}

	// Check for sequential characters
	if hasSequentialChars(secret) {
		return fmt.Errorf("client secret contains sequential characters")
	}

	// Check for repeated characters
	if hasRepeatedChars(secret) {
		return fmt.Errorf("client secret contains too many repeated characters")
	}

	return nil
}

// hasSequentialChars checks for sequential characters (e.g., "abc", "123")
func hasSequentialChars(s string) bool {
	if len(s) < 3 {
		return false
	}

	for i := 0; i < len(s)-2; i++ {
		if s[i+1] == s[i]+1 && s[i+2] == s[i]+2 {
			return true
		}
		if s[i+1] == s[i]-1 && s[i+2] == s[i]-2 {
			return true
		}
	}
	return false
}

// hasRepeatedChars checks for too many repeated characters
func hasRepeatedChars(s string) bool {
	if len(s) < 4 {
		return false
	}

	count := 1
	for i := 1; i < len(s); i++ {
		if s[i] == s[i-1] {
			count++
			if count >= 4 {
				return true
			}
		} else {
			count = 1
		}
	}
	return false
}

// SecureCredentials creates a secure version of credentials for processing
func SecureCredentials(creds *types.Credentials) (*types.Credentials, error) {
	// Validate secret format
	if err := ValidateSecretFormat(creds.ClientSecret); err != nil {
		return nil, fmt.Errorf("security validation failed: %w", err)
	}

	// Create a secure copy
	secureCreds := &types.Credentials{
		ClientID:     creds.ClientID,
		ClientSecret: HashSecret(creds.ClientSecret), // Hash the secret
		Environment:  creds.Environment,
	}

	return secureCreds, nil
}

// ClearSensitiveData clears sensitive data from memory
func ClearSensitiveData(data []byte) {
	for i := range data {
		data[i] = 0
	}
}

// IsSecureEnvironment checks if we're running in a secure environment
func IsSecureEnvironment() bool {
	// TODO: inject a checker or read an env/config flag set by the host (e.g., HTTPS detected).
	return false
}
