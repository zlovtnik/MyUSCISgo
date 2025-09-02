package security

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"os"
	"strings"
	"time"

	"MyUSCISgo/pkg/types"
)

// TokenProvider defines the interface for OAuth token generation
type TokenProvider interface {
	GenerateToken(ctx context.Context, clientID, clientSecret string) (*types.OAuthToken, error)
	RefreshToken(ctx context.Context, clientID, clientSecret, refreshToken string) (*types.OAuthToken, error)
	IsProductionReady() bool
}

// MockTokenProvider implements TokenProvider for development/testing
type MockTokenProvider struct{}

// IsProductionReady returns false for MockTokenProvider
func (m *MockTokenProvider) IsProductionReady() bool {
	return false
}

// GenerateToken generates a mock OAuth token for development
func (m *MockTokenProvider) GenerateToken(ctx context.Context, clientID, clientSecret string) (*types.OAuthToken, error) {
	// Check if context is cancelled
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// Generate a mock token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, fmt.Errorf("failed to generate mock token: %w", err)
	}

	// Create token with expiration (1 hour from now)
	expiresAt := time.Now().Add(time.Hour)

	token := &types.OAuthToken{
		AccessToken: hex.EncodeToString(tokenBytes),
		TokenType:   "Bearer",
		ExpiresIn:   3600, // 1 hour in seconds
		ExpiresAt:   expiresAt.Format(time.RFC3339),
		Scope:       "case-status:read",
	}

	return token, nil
}

// RefreshToken refreshes a mock OAuth token
func (m *MockTokenProvider) RefreshToken(ctx context.Context, clientID, clientSecret, refreshToken string) (*types.OAuthToken, error) {
	// For mock, just generate a new token
	return m.GenerateToken(ctx, clientID, clientSecret)
}

// USCISTokenProvider implements TokenProvider for production USCIS API
type USCISTokenProvider struct {
	baseURL string
}

// IsProductionReady returns true for USCISTokenProvider
func (u *USCISTokenProvider) IsProductionReady() bool {
	return true
}

// GenerateToken generates a real OAuth token from USCIS API
func (u *USCISTokenProvider) GenerateToken(ctx context.Context, clientID, clientSecret string) (*types.OAuthToken, error) {
	// TODO: Implement actual USCIS OAuth token generation
	// This would make HTTP requests to USCIS OAuth endpoints
	return nil, fmt.Errorf("USCIS token provider not yet implemented")
}

// RefreshToken refreshes a real OAuth token from USCIS API
func (u *USCISTokenProvider) RefreshToken(ctx context.Context, clientID, clientSecret, refreshToken string) (*types.OAuthToken, error) {
	// TODO: Implement actual USCIS token refresh
	return nil, fmt.Errorf("USCIS token refresh not yet implemented")
}

// NewTokenProvider creates the appropriate TokenProvider based on environment
func NewTokenProvider() (TokenProvider, error) {
	env := strings.ToLower(os.Getenv("APP_ENV"))
	if env == "" {
		env = strings.ToLower(os.Getenv("GO_ENV"))
	}
	if env == "" {
		env = "development" // default to development
	}

	switch env {
	case "production", "prod":
		// In production, require USCIS configuration
		uscisURL := os.Getenv("USCIS_BASE_URL")
		if uscisURL == "" {
			return nil, fmt.Errorf("USCIS_BASE_URL environment variable is required in production")
		}

		return &USCISTokenProvider{
			baseURL: uscisURL,
		}, nil

	case "development", "dev", "test":
		// Allow mock provider in non-production environments
		return &MockTokenProvider{}, nil

	default:
		return nil, fmt.Errorf("unsupported APP_ENV: %s", env)
	}
}

// EnforceProductionReadiness ensures production environment uses production-ready providers
func EnforceProductionReadiness(provider TokenProvider) error {
	env := strings.ToLower(os.Getenv("APP_ENV"))
	if env == "" {
		env = strings.ToLower(os.Getenv("GO_ENV"))
	}

	isProduction := env == "production" || env == "prod"

	if isProduction && !provider.IsProductionReady() {
		return fmt.Errorf("production environment requires production-ready token provider, but got mock provider")
	}

	return nil
}

// Global token provider instance
var globalTokenProvider TokenProvider

// InitTokenProvider initializes the global token provider
func InitTokenProvider() error {
	provider, err := NewTokenProvider()
	if err != nil {
		return fmt.Errorf("failed to create token provider: %w", err)
	}

	if err := EnforceProductionReadiness(provider); err != nil {
		return fmt.Errorf("token provider validation failed: %w", err)
	}

	globalTokenProvider = provider
	return nil
}

// GetTokenProvider returns the global token provider
func GetTokenProvider() TokenProvider {
	if globalTokenProvider == nil {
		// Fallback to mock provider if not initialized
		globalTokenProvider = &MockTokenProvider{}
	}
	return globalTokenProvider
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

// GenerateOAuthToken generates an OAuth token using the configured provider
func GenerateOAuthToken(ctx context.Context, clientID, clientSecret string) (*types.OAuthToken, error) {
	provider := GetTokenProvider()
	return provider.GenerateToken(ctx, clientID, clientSecret)
}

// RefreshOAuthToken refreshes an expired OAuth token using the configured provider
func RefreshOAuthToken(ctx context.Context, clientID, clientSecret, refreshToken string) (*types.OAuthToken, error) {
	provider := GetTokenProvider()
	return provider.RefreshToken(ctx, clientID, clientSecret, refreshToken)
}

// ValidateOAuthToken validates an OAuth token format and expiration
// TODO: Consider injecting time.Now via a var to test edge cases (skew, near-expiry)
func ValidateOAuthToken(token *types.OAuthToken) error {
	if token == nil {
		return fmt.Errorf("token is nil")
	}

	if token.AccessToken == "" {
		return fmt.Errorf("access token is empty")
	}

	// Check if token is expired by parsing ExpiresAt
	if token.ExpiresAt != "" {
		expiresAt, err := time.Parse(time.RFC3339, token.ExpiresAt)
		if err != nil {
			return fmt.Errorf("invalid token expiration format: %w", err)
		}
		if time.Now().After(expiresAt) {
			return fmt.Errorf("token has expired")
		}
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
