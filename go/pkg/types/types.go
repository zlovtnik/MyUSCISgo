package types

import (
	"encoding/json"
	"strings"
)

// Credentials represents the client credentials and environment information
type Credentials struct {
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	Environment  string `json:"environment"`
}

// ProcessingResult represents the result of processing credentials
type ProcessingResult struct {
	BaseURL   string            `json:"baseURL"`
	AuthMode  string            `json:"authMode"`
	TokenHint string            `json:"tokenHint"`
	Config    map[string]string `json:"config"`
}

// WASMResponse represents the response sent back to JavaScript
type WASMResponse struct {
	Success bool              `json:"success,omitempty"`
	Result  *ProcessingResult `json:"result,omitempty"`
	Error   string            `json:"error,omitempty"`
}

// Environment represents the supported environments
type Environment string

const (
	EnvDevelopment Environment = "development"
	EnvStaging     Environment = "staging"
	EnvProduction  Environment = "production"
)

// String returns the string representation of the environment
func (e Environment) String() string {
	return string(e)
}

// IsValid checks if the environment is valid
func (e Environment) IsValid() bool {
	switch e {
	case EnvDevelopment, EnvStaging, EnvProduction:
		return true
	default:
		return false
	}
}

// ToEnvironment converts a string to Environment type
func ToEnvironment(s string) Environment {
	switch strings.ToLower(s) {
	case "development":
		return EnvDevelopment
	case "staging":
		return EnvStaging
	case "production":
		return EnvProduction
	default:
		return Environment(s)
	}
}

// MarshalJSON implements custom JSON marshaling for WASMResponse
func (r WASMResponse) MarshalJSON() ([]byte, error) {
	if r.Success {
		return json.Marshal(map[string]interface{}{
			"success": true,
			"result":  r.Result,
		})
	}
	return json.Marshal(map[string]interface{}{
		"success": false,
		"error":   r.Error,
	})
}
