package validation

import (
	"errors"
	"regexp"
	"strings"

	"MyUSCISgo/pkg/types"
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
	if strings.TrimSpace(clientID) == "" {
		return ValidationError{Field: "clientId", Message: "client ID cannot be empty"}
	}

	// Sanitize input first
	clientID = SanitizeInput(clientID)

	// Client ID should be alphanumeric with hyphens and underscores
	matched, err := regexp.MatchString(`^[a-zA-Z0-9\-_]+$`, clientID)
	if err != nil {
		return ValidationError{Field: "clientId", Message: "invalid client ID format"}
	}
	if !matched {
		return ValidationError{Field: "clientId", Message: "client ID must contain only alphanumeric characters, hyphens, and underscores"}
	}

	if len(clientID) < 3 || len(clientID) > 100 {
		return ValidationError{Field: "clientId", Message: "client ID must be between 3 and 100 characters"}
	}

	return nil
}

// ValidateClientSecret validates the client secret
func ValidateClientSecret(clientSecret string) error {
	if strings.TrimSpace(clientSecret) == "" {
		return ValidationError{Field: "clientSecret", Message: "client secret cannot be empty"}
	}

	// Sanitize input first
	clientSecret = SanitizeInput(clientSecret)

	if len(clientSecret) < 8 {
		return ValidationError{Field: "clientSecret", Message: "client secret must be at least 8 characters long"}
	}

	if len(clientSecret) > 255 {
		return ValidationError{Field: "clientSecret", Message: "client secret must be less than 255 characters"}
	}

	// Check for basic complexity (at least one letter and one number)
	hasLetter := regexp.MustCompile(`[a-zA-Z]`).MatchString(clientSecret)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(clientSecret)

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
func SanitizeInput(input string) string {
	// Remove any potential script tags or HTML
	input = strings.ReplaceAll(input, "<", "&lt;")
	input = strings.ReplaceAll(input, ">", "&gt;")
	input = strings.ReplaceAll(input, "\"", "&quot;")
	input = strings.ReplaceAll(input, "'", "&#x27;")
	input = strings.ReplaceAll(input, "&", "&amp;")

	// Remove potential JavaScript injection patterns
	input = regexp.MustCompile(`javascript:`).ReplaceAllString(input, "")
	input = regexp.MustCompile(`on\w+\s*=`).ReplaceAllString(input, "")
	input = regexp.MustCompile(`<script[^>]*>.*?</script>`).ReplaceAllString(input, "")

	// Remove null bytes and control characters
	input = regexp.MustCompile(`[\x00-\x1F\x7F-\x9F]`).ReplaceAllString(input, "")

	// Trim whitespace
	return strings.TrimSpace(input)
}
