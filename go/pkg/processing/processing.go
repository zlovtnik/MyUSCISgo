package processing

import (
	"context"
	"fmt"
	"time"

	"MyUSCISgo/pkg/logging"
	"MyUSCISgo/pkg/security"
	"MyUSCISgo/pkg/types"
)

// Processor handles the processing of credentials based on environment
type Processor struct {
	logger *logging.Logger
}

// NewProcessor creates a new processor instance
func NewProcessor() *Processor {
	return &Processor{
		logger: logging.NewLogger(logging.LogLevelInfo),
	}
}

// ProcessCredentialsAsync processes credentials asynchronously using Go 1.25 features
func (p *Processor) ProcessCredentialsAsync(ctx context.Context, creds *types.Credentials) (<-chan *types.ProcessingResult, <-chan error) {
	resultCh := make(chan *types.ProcessingResult, 1)
	errCh := make(chan error, 1)

	go func() {
		defer close(resultCh)
		defer close(errCh)

		// Create secure version of credentials
		secureCreds, err := security.SecureCredentials(creds)
		if err != nil {
			p.logger.Error("Failed to secure credentials", err, logging.SanitizeLogData(map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
			}))
			errCh <- fmt.Errorf("security validation failed: %w", err)
			return
		}

		p.logger.Info("Starting credential processing", map[string]interface{}{
			"clientId":    secureCreds.ClientID,
			"environment": secureCreds.Environment,
		})

		// Simulate async processing with context support
		result, err := p.processWithContext(ctx, secureCreds)
		if err != nil {
			p.logger.Error("Processing failed", err, map[string]interface{}{
				"clientId":    secureCreds.ClientID,
				"environment": secureCreds.Environment,
			})
			errCh <- err
			return
		}

		p.logger.Info("Credential processing completed", map[string]interface{}{
			"clientId":    secureCreds.ClientID,
			"environment": secureCreds.Environment,
		})

		resultCh <- result
	}()

	return resultCh, errCh
}
func (p *Processor) ProcessCredentialsSync(ctx context.Context, creds *types.Credentials) (*types.ProcessingResult, error) {
	// Create secure version of credentials
	secureCreds, err := security.SecureCredentials(creds)
	if err != nil {
		return nil, fmt.Errorf("security validation failed: %w", err)
	}

	p.logger.Info("Starting synchronous credential processing", map[string]interface{}{
		"clientId":    secureCreds.ClientID,
		"environment": secureCreds.Environment,
	})

	// Process with context
	result, err := p.processWithContext(ctx, secureCreds)
	if err != nil {
		return nil, err
	}

	p.logger.Info("Synchronous credential processing completed", map[string]interface{}{
		"clientId":    secureCreds.ClientID,
		"environment": secureCreds.Environment,
	})

	return result, nil
}

// processWithContext processes credentials with context support
func (p *Processor) processWithContext(ctx context.Context, creds *types.Credentials) (*types.ProcessingResult, error) {
	// Check if context is cancelled
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}

	// Generate secure token
	token, err := security.GenerateSecureToken(creds.ClientID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Generate OAuth token for USCIS API
	oauthToken, err := security.GenerateOAuthToken(creds.ClientID, creds.ClientSecret)
	if err != nil {
		p.logger.Error("Failed to generate OAuth token", err, logging.SanitizeLogData(map[string]interface{}{
			"clientId":    creds.ClientID,
			"environment": creds.Environment,
		}))
		return nil, fmt.Errorf("failed to generate OAuth token: %w", err)
	}

	// Process based on environment
	result := &types.ProcessingResult{
		TokenHint:  token,
		OAuthToken: convertToTypesOAuthToken(oauthToken),
		Config:     make(map[string]string),
	}

	switch types.ToEnvironment(creds.Environment) {
	case types.EnvDevelopment:
		result.BaseURL = "https://api-int.uscis.gov/case-status"
		result.AuthMode = "oauth"
		result.Config["debug"] = "true"
		result.Config["timeout"] = "30s"
		result.Config["retryCount"] = "3"
		result.Config["oauth_endpoint"] = "https://api-int.uscis.gov/oauth/token"
		result.Config["api_version"] = "v1"

	case types.EnvStaging:
		result.BaseURL = "https://api-staging.uscis.gov/case-status"
		result.AuthMode = "oauth"
		result.Config["debug"] = "false"
		result.Config["timeout"] = "60s"
		result.Config["retryCount"] = "5"
		result.Config["oauth_endpoint"] = "https://api-staging.uscis.gov/oauth/token"
		result.Config["api_version"] = "v1"

	case types.EnvProduction:
		result.BaseURL = "https://api.uscis.gov/case-status"
		result.AuthMode = "oauth"
		result.Config["debug"] = "false"
		result.Config["timeout"] = "120s"
		result.Config["retryCount"] = "10"
		result.Config["rateLimit"] = "1000"
		result.Config["oauth_endpoint"] = "https://api.uscis.gov/oauth/token"
		result.Config["api_version"] = "v1"
	}

	// Simulate some processing time
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(100 * time.Millisecond):
	}

	// Validate OAuth token
	if result.OAuthToken != nil {
		securityToken := &security.OAuthToken{
			AccessToken: result.OAuthToken.AccessToken,
			TokenType:   result.OAuthToken.TokenType,
			ExpiresIn:   result.OAuthToken.ExpiresIn,
			Scope:       result.OAuthToken.Scope,
		}

		if expiresAt, err := time.Parse(time.RFC3339, result.OAuthToken.ExpiresAt); err == nil {
			securityToken.ExpiresAt = expiresAt
		}

		if err := security.ValidateOAuthToken(securityToken); err != nil {
			p.logger.Warn("OAuth token validation failed, attempting refresh", map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
				"error":       err.Error(),
			})

			// Attempt to refresh the token
			newToken, refreshErr := security.RefreshOAuthToken(creds.ClientID, creds.ClientSecret, "")
			if refreshErr != nil {
				p.logger.Error("OAuth token refresh failed", refreshErr, logging.SanitizeLogData(map[string]interface{}{
					"clientId":    creds.ClientID,
					"environment": creds.Environment,
				}))
				return nil, fmt.Errorf("OAuth token refresh failed: %w", refreshErr)
			}

			result.OAuthToken = convertToTypesOAuthToken(newToken)
			p.logger.Info("OAuth token refreshed successfully", map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
				"tokenType":   newToken.TokenType,
				"scope":       newToken.Scope,
			})
		}
	}

	return result, nil
}

// addEnvironmentSpecificProcessing adds environment-specific logic
func (p *Processor) addEnvironmentSpecificProcessing(ctx context.Context, result *types.ProcessingResult, env string) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	switch types.ToEnvironment(env) {
	case types.EnvDevelopment:
		// Development: Add mock API simulation
		result.Config["mockAPI"] = "true"
		result.Config["logLevel"] = "debug"
		result.Config["features"] = "all"

	case types.EnvStaging:
		// Staging: Add testing features
		result.Config["mockAPI"] = "false"
		result.Config["logLevel"] = "info"
		result.Config["features"] = "most"
		result.Config["testMode"] = "true"

	case types.EnvProduction:
		// Production: Add security and performance features
		result.Config["mockAPI"] = "false"
		result.Config["logLevel"] = "warn"
		result.Config["features"] = "essential"
		result.Config["security"] = "enhanced"
		result.Config["monitoring"] = "enabled"
	}

	p.logger.Debug("Environment-specific processing completed", map[string]interface{}{
		"environment": env,
		"configKeys":  len(result.Config),
	})

	return nil
}

// SimulateAPI simulates API calls for different environments
func (p *Processor) SimulateAPI(ctx context.Context, result *types.ProcessingResult, env string) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	p.logger.Info("Simulating USCIS API call", map[string]interface{}{
		"environment": env,
		"baseURL":     result.BaseURL,
		"authMode":    result.AuthMode,
		"hasToken":    result.OAuthToken != nil,
	})

	// Validate OAuth token before API call
	if result.OAuthToken != nil {
		p.logger.Debug("Validating OAuth token for API call", map[string]interface{}{
			"tokenType": result.OAuthToken.TokenType,
			"scope":     result.OAuthToken.Scope,
		})
	}

	// Simulate network delay
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(200 * time.Millisecond):
	}

	// Simulate different responses based on environment
	switch types.ToEnvironment(env) {
	case types.EnvDevelopment:
		result.Config["apiStatus"] = "mock_success"
		result.Config["responseTime"] = "50ms"
		result.Config["oauth_valid"] = "true"
	case types.EnvStaging:
		result.Config["apiStatus"] = "test_success"
		result.Config["responseTime"] = "150ms"
		result.Config["oauth_valid"] = "true"
	case types.EnvProduction:
		result.Config["apiStatus"] = "live_success"
		result.Config["responseTime"] = "300ms"
		result.Config["oauth_valid"] = "true"
	}

	p.logger.Info("USCIS API simulation completed", map[string]interface{}{
		"environment":  env,
		"apiStatus":    result.Config["apiStatus"],
		"responseTime": result.Config["responseTime"],
	})

	return nil
}

// convertToTypesOAuthToken converts security.OAuthToken to types.OAuthToken
func convertToTypesOAuthToken(token *security.OAuthToken) *types.OAuthToken {
	if token == nil {
		return nil
	}
	return &types.OAuthToken{
		AccessToken: token.AccessToken,
		TokenType:   token.TokenType,
		ExpiresIn:   token.ExpiresIn,
		ExpiresAt:   token.ExpiresAt.Format(time.RFC3339),
		Scope:       token.Scope,
	}
}
