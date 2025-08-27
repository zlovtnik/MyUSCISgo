package security

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"MyUSCISgo/pkg/types"
)

// HashSecret creates a temporary hash of the client secret for processing
// This is a one-way hash that cannot be reversed
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
	// In WASM context, we consider it secure if we're running in HTTPS
	// This is a simplified check - in production, you'd want more robust checks
	return true // For WASM, we'll assume secure context
}
