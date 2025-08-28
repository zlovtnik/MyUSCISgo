package validation

import (
	"errors"
	"html"
	"regexp"
	"strings"

	"MyUSCISgo/pkg/types"
)

var (
	// Precompiled regexes for input sanitization
	rxScriptTag = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	rxCtrlChars = regexp.MustCompile(`[\x00-\x1F\x7F-\x9F]`)
	// Dangerous URI schemes that should be stripped
	rxDangerousURISchemes = regexp.MustCompile(`(?i)(?:javascript|vbscript|data|file|ftp):[^>\s]*`)
	// Event handler attributes that should be stripped
	rxEventHandlers = regexp.MustCompile(`(?i)\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)`)

	// Precompiled regexes for client secret validation
	rxHasLetter = regexp.MustCompile(`[a-zA-Z]`)
	rxHasNumber = regexp.MustCompile(`[0-9]`)
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string
	Message string
}

func (e ValidationError) Error() string {
	return e.Message
}

// ValidateCredentials validates the credentials structure
func ValidateCredentials(creds *types.Credentials) error {
	var errs []string

	// Validate ClientID
	if err := ValidateClientID(creds.ClientID); err != nil {
		errs = append(errs, err.Error())
	}

	// Validate ClientSecret
	if err := ValidateClientSecret(creds.ClientSecret); err != nil {
		errs = append(errs, err.Error())
	}

	// Validate Environment
	if err := ValidateEnvironment(creds.Environment); err != nil {
		errs = append(errs, err.Error())
	}

	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}

	return nil
}

// ValidateClientID validates the client ID format
func ValidateClientID(clientID string) error {
	trimmedID := strings.TrimSpace(clientID)
	if trimmedID == "" {
		return ValidationError{Field: "clientId", Message: "client ID cannot be empty"}
	}

	// Validate format rules on raw trimmed input (no sanitization)
	matched, err := regexp.MatchString(`^[a-zA-Z0-9\-_]+$`, trimmedID)
	if err != nil {
		return ValidationError{Field: "clientId", Message: "invalid client ID format"}
	}
	if !matched {
		return ValidationError{Field: "clientId", Message: "client ID must contain only alphanumeric characters, hyphens, and underscores"}
	}

	if len(trimmedID) < 3 || len(trimmedID) > 100 {
		return ValidationError{Field: "clientId", Message: "client ID must be between 3 and 100 characters"}
	}

	return nil
}

// ValidateClientSecret validates the client secret
func ValidateClientSecret(clientSecret string) error {
	trimmed := strings.TrimSpace(clientSecret)
	if trimmed == "" {
		return ValidationError{Field: "clientSecret", Message: "client secret cannot be empty"}
	}

	// Validate length constraints on trimmed input
	if len(trimmed) < 8 {
		return ValidationError{Field: "clientSecret", Message: "client secret must be at least 8 characters long"}
	}

	if len(trimmed) > 255 {
		return ValidationError{Field: "clientSecret", Message: "client secret must be less than 255 characters"}
	}

	// Check for basic complexity on trimmed input (at least one letter and one number)
	hasLetter := rxHasLetter.MatchString(trimmed)
	hasNumber := rxHasNumber.MatchString(trimmed)

	if !hasLetter || !hasNumber {
		return ValidationError{Field: "clientSecret", Message: "client secret must contain at least one letter and one number"}
	}

	return nil
}

// ValidateEnvironment validates the environment string
func ValidateEnvironment(env string) error {
	environment := types.ToEnvironment(env)
	if !environment.IsValid() {
		return ValidationError{Field: "environment", Message: "environment must be one of: development, staging, production"}
	}
	return nil
}

// SanitizeInput sanitizes user input to prevent injection attacks
//
// Security improvements:
// - Strips dangerous URI schemes (javascript:, vbscript:, data:, file:, ftp:) that could execute code
// - Removes event handler attributes (onClick, onMouseOver, etc.) that could execute JavaScript
// - Removes script tags and other injection patterns
// - HTML encodes remaining content to prevent XSS
//
// Note: This function provides defense in depth. Callers should still:
// - Escape output appropriately when rendering in HTML contexts
// - Validate input on the client side as well
// - Use Content Security Policy (CSP) headers
// - Implement proper authentication and authorization
func SanitizeInput(input string) string {
	// Remove dangerous URI schemes (javascript:, vbscript:, data:, file:, ftp:)
	input = rxDangerousURISchemes.ReplaceAllString(input, "")

	// Remove event handler attributes (onClick, onMouseOver, etc.)
	input = rxEventHandlers.ReplaceAllString(input, "")

	// Remove potential script injection patterns
	input = rxScriptTag.ReplaceAllString(input, "")

	// HTML escape &, <, >, and " using the standard library
	input = html.EscapeString(input)

	// Handle single quotes separately (html.EscapeString doesn't escape them)
	input = strings.ReplaceAll(input, "'", "&#39;")

	// Remove null bytes and control characters
	input = rxCtrlChars.ReplaceAllString(input, "")

	// Trim whitespace
	return strings.TrimSpace(input)
}
