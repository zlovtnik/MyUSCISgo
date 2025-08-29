//go:build js && wasm

package wasm

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"runtime/debug"
	"strings"
	"sync"
	"syscall/js"
	"time"

	"MyUSCISgo/pkg/logging"
	"MyUSCISgo/pkg/processing"
	"MyUSCISgo/pkg/ratelimit"
	"MyUSCISgo/pkg/security"
	"MyUSCISgo/pkg/types"
	"MyUSCISgo/pkg/validation"
)

const (
	// ProcessingTimeoutMsg is the error message for processing timeouts
	ProcessingTimeoutMsg = "Processing timeout"
	// PanicMsg is the error message for Go panics
	PanicMsg = "Go panic: %v"
	// JWT validation constants
	JWTIssuer    = "uscis-api"
	JWTAudience  = "uscis-client"
	JWTAlgorithm = "HS256"
	// Token validation rate limiting
	TokenValidationRateLimit = 100 // requests per minute per IP
)

// JWTClaims represents the standard JWT claims
type JWTClaims struct {
	Issuer     string `json:"iss"`
	Subject    string `json:"sub"`
	Audience   string `json:"aud"`
	ExpiresAt  int64  `json:"exp"`
	IssuedAt   int64  `json:"iat"`
	CaseNumber string `json:"case_number"`
}

// TokenValidationConfig holds configuration for token validation
type TokenValidationConfig struct {
	SigningKey       string
	Issuer           string
	Audience         string
	ClockSkew        time.Duration
	EnableRevocation bool
}

// TokenStore represents a secure token storage interface
type TokenStore interface {
	IsRevoked(tokenID string) bool
	IsValid(tokenID string) bool
}

// InMemoryTokenStore provides a simple in-memory token store
type InMemoryTokenStore struct {
	mu      sync.RWMutex
	revoked map[string]time.Time
	valid   map[string]time.Time
}

// NewInMemoryTokenStore creates a new in-memory token store
func NewInMemoryTokenStore() *InMemoryTokenStore {
	return &InMemoryTokenStore{
		revoked: make(map[string]time.Time),
		valid:   make(map[string]time.Time),
	}
}

// IsRevoked checks if a token is revoked
func (s *InMemoryTokenStore) IsRevoked(tokenID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, exists := s.revoked[tokenID]
	return exists
}

// IsValid checks if a token is in the valid token list
func (s *InMemoryTokenStore) IsValid(tokenID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, exists := s.valid[tokenID]
	return exists
}

// AddValidToken adds a token to the valid list
func (s *InMemoryTokenStore) AddValidToken(tokenID string, expiresAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.valid[tokenID] = expiresAt
}

// generateSecureTokenHash creates a secure hash of the token for logging purposes
func generateSecureTokenHash(token string) string {
	if token == "" {
		return ""
	}
	hash := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", hash)
}

// RevokeToken marks a token as revoked
func (s *InMemoryTokenStore) RevokeToken(tokenID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.revoked[tokenID] = time.Now()
	delete(s.valid, tokenID)
}

// loadSecureSigningKey loads the JWT signing key from secure configuration
func loadSecureSigningKey() string {
	// Load from environment variable first
	if key := getEnvVar("JWT_SIGNING_KEY"); key != "" {
		return key
	}

	// Fallback to default key for development (CHANGE THIS IN PRODUCTION)
	// This should only be used in development environments
	return "default-development-signing-key-change-in-production"
}

// getEnvVar gets an environment variable (WASM-compatible)
func getEnvVar(key string) string {
	// In WASM environment, we can't directly access environment variables
	// This would need to be passed from JavaScript or use a different mechanism
	// For now, return empty string to trigger fallback
	return ""
}

// Package-level compiled regex for case number validation
var caseNumberRegex = regexp.MustCompile(`^[A-Z]{3}\d{10}$`)

// Handler handles WASM function calls from JavaScript
type Handler struct {
	processor         *processing.Processor
	logger            *logging.Logger
	rateLimiter       *ratelimit.RateLimiter
	tokenStore        TokenStore
	tokenConfig       *TokenValidationConfig
	validationLimiter *ratelimit.RateLimiter
}

// NewHandler creates a new WASM handler
func NewHandler() *Handler {
	return &Handler{
		processor:   processing.NewProcessor(),
		logger:      logging.NewLogger(logging.LogLevelInfo),
		rateLimiter: ratelimit.NewRateLimiter(10, time.Minute), // 10 requests per minute
		tokenStore:  NewInMemoryTokenStore(),
		tokenConfig: &TokenValidationConfig{
			SigningKey:       loadSecureSigningKey(),
			Issuer:           JWTIssuer,
			Audience:         JWTAudience,
			ClockSkew:        5 * time.Minute,
			EnableRevocation: true,
		},
		validationLimiter: ratelimit.NewRateLimiter(TokenValidationRateLimit, time.Minute),
	}
}

// ProcessCredentialsAsync handles the async processing of credentials from JavaScript
func (h *Handler) ProcessCredentialsAsync(this js.Value, args []js.Value) any {
	defer func() {
		if r := recover(); r != nil {
			h.logger.Error("Panic in ProcessCredentialsAsync", fmt.Errorf("%v", r), map[string]interface{}{
				"stack": string(debug.Stack()),
			})
			js.Global().Get("console").Call("error", fmt.Sprintf(PanicMsg, r))
		}
	}()

	h.logger.Info("Received credentials processing request from JavaScript")

	if len(args) != 1 {
		err := fmt.Errorf("invalid number of arguments: expected 1, got %d", len(args))
		h.logger.Error("Invalid arguments", err)
		return js.Global().Get("Promise").Call("reject", h.createErrorResponse(err.Error()))
	}

	// Parse JSON input
	credJSON := args[0].String()
	h.logger.Debug("Parsing credentials JSON", map[string]interface{}{
		"jsonLength": len(credJSON),
	})

	var creds types.Credentials
	if err := json.Unmarshal([]byte(credJSON), &creds); err != nil {
		h.logger.Error("Failed to parse credentials JSON", err)
		return js.Global().Get("Promise").Call("reject",
			h.createErrorResponse(fmt.Sprintf("Failed to parse credentials: %v", err)))
	}

	// Validate credentials
	if err := validation.ValidateCredentials(&creds); err != nil {
		h.logger.Error("Credential validation failed", err, logging.SanitizeLogData(map[string]interface{}{
			"clientId":    creds.ClientID,
			"environment": creds.Environment,
		}))
		return js.Global().Get("Promise").Call("reject", h.createErrorResponse(err.Error()))
	}

	// Rate limiting check - use client identifier derived from validated credentials
	rateLimitKey := fmt.Sprintf("%s:%s", creds.Environment, creds.ClientID)
	if !h.rateLimiter.Allow(rateLimitKey) {
		h.logger.Warn("Rate limit exceeded", map[string]interface{}{
			"rateLimitKey": rateLimitKey,
			"clientId":     creds.ClientID,
			"environment":  creds.Environment,
		})
		return js.Global().Get("Promise").Call("reject", h.createErrorResponse("Rate limit exceeded. Please try again later."))
	}

	h.logger.Info("Credentials validated successfully", map[string]interface{}{
		"clientId":    creds.ClientID,
		"environment": creds.Environment,
	})

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Send initial progress update
	h.sendProgressUpdate("validation_started", map[string]interface{}{
		"clientId":    creds.ClientID,
		"environment": creds.Environment,
	})

	// Process asynchronously
	resultCh, errCh := h.processor.ProcessCredentialsAsync(ctx, &creds)

	// Return a Promise
	return h.createPromise(func(resolve, reject js.Value) {
		select {
		case result := <-resultCh:
			h.sendProgressUpdate("processing_completed", map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
				"success":     true,
			})
			h.logger.Info("Processing completed successfully", map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
			})
			resolve.Invoke(h.createSuccessResponse(result))
		case err := <-errCh:
			h.sendProgressUpdate("processing_failed", map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
				"error":       err.Error(),
			})
			h.logger.Error("Processing failed", err, map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
			})
			reject.Invoke(h.createErrorResponse(err.Error()))
		case <-ctx.Done():
			err := ctx.Err()
			h.sendProgressUpdate("processing_timeout", map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
				"error":       ProcessingTimeoutMsg,
			})
			h.logger.Error(ProcessingTimeoutMsg, err, map[string]interface{}{
				"clientId":    creds.ClientID,
				"environment": creds.Environment,
			})
			reject.Invoke(h.createErrorResponse(ProcessingTimeoutMsg))
		}
	})
}

// createPromise creates a JavaScript Promise
func (h *Handler) createPromise(executor func(resolve, reject js.Value)) js.Value {
	promiseConstructor := js.Global().Get("Promise")
	return promiseConstructor.New(js.FuncOf(func(this js.Value, args []js.Value) any {
		resolve := args[0]
		reject := args[1]
		executor(resolve, reject)
		return nil
	}))
}

// createSuccessResponse creates a success response
func (h *Handler) createSuccessResponse(result *types.ProcessingResult) js.Value {
	response := types.WASMResponse{
		Success: true,
		Result:  result,
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		h.logger.Error("Failed to marshal success response", err)
		return h.createErrorResponse("Failed to create response")
	}

	return js.ValueOf(string(jsonData))
}

// createErrorResponse creates an error response
func (h *Handler) createErrorResponse(errorMsg string) js.Value {
	response := types.WASMResponse{
		Success: false,
		Error:   errorMsg,
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		h.logger.Error("Failed to marshal error response", err)
		// Fallback to plain error
		return js.ValueOf(fmt.Sprintf(`{"success":false,"error":"%s"}`, errorMsg))
	}

	return js.ValueOf(string(jsonData))
}

// sendProgressUpdate sends progress updates to JavaScript
func (h *Handler) sendProgressUpdate(updateType string, data map[string]interface{}) {
	// Call JavaScript callback if available
	jsCallback := js.Global().Get("goSetRealtimeCallback")
	if !jsCallback.IsUndefined() && jsCallback.Type() == js.TypeFunction {
		update := map[string]interface{}{
			"type":      updateType,
			"data":      data,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		}

		jsonData, err := json.Marshal(update)
		if err != nil {
			h.logger.Error("Failed to marshal progress update", err)
			return
		}

		jsCallback.Invoke(string(jsonData))
	}
}

// HealthCheck provides a simple health check function
func (h *Handler) HealthCheck(this js.Value, args []js.Value) any {
	h.logger.Debug("Health check requested")

	response := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"version":   "1.0.0",
		"features": []string{
			"async-processing",
			"security-validation",
			"structured-logging",
			"environment-specific-logic",
		},
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		h.logger.Error("Failed to marshal health check response", err)
		return js.ValueOf(`{"status":"error","message":"Failed to create health response"}`)
	}

	return js.ValueOf(string(jsonData))
}

// SendRealtimeUpdate sends real-time updates to JavaScript
func (h *Handler) SendRealtimeUpdate(this js.Value, args []js.Value) any {
	defer func() {
		if r := recover(); r != nil {
			h.logger.Error("Panic in SendRealtimeUpdate", fmt.Errorf("%v", r), map[string]interface{}{
				"stack": string(debug.Stack()),
			})
			js.Global().Get("console").Call("error", fmt.Sprintf(PanicMsg, r))
		}
	}()

	// Defensively handle undefined/null receivers
	if this.IsUndefined() || this.IsNull() {
		// Use js.Null() as a safe default for internal calls
		this = js.Null()
	}

	if len(args) != 2 {
		err := fmt.Errorf("invalid number of arguments: expected 2, got %d", len(args))
		h.logger.Error("Invalid arguments for realtime update", err)
		return h.createErrorResponse(err.Error())
	}

	messageType := args[0].String()
	data := args[1]

	// Handle JavaScript data based on its type
	var processedData interface{}
	var logDataStr string

	// Check if data is a JavaScript primitive
	dataType := data.Type()
	switch dataType {
	case js.TypeString:
		// Handle string primitive
		processedData = data.String()
		logDataStr = data.String()
	case js.TypeNumber:
		// Handle number primitive
		processedData = data.Float()
		logDataStr = fmt.Sprintf("%g", data.Float())
	case js.TypeBoolean:
		// Handle boolean primitive
		processedData = data.Bool()
		logDataStr = fmt.Sprintf("%t", data.Bool())
	case js.TypeNull, js.TypeUndefined:
		// Handle null/undefined
		processedData = nil
		logDataStr = "null"
	default:
		// Handle objects/arrays - use JSON.stringify and unmarshal
		jsonStringify := js.Global().Get("JSON").Get("stringify")
		jsonDataStr := jsonStringify.Invoke(data).String()

		// Try to unmarshal into a Go interface{} to preserve structure
		var unmarshaled interface{}
		if err := json.Unmarshal([]byte(jsonDataStr), &unmarshaled); err != nil {
			h.logger.Warn("Failed to unmarshal JSON data, using raw string", map[string]interface{}{
				"error":      err.Error(),
				"jsonString": jsonDataStr,
			})
			// Fallback: store as string if unmarshaling fails
			processedData = jsonDataStr
			logDataStr = jsonDataStr
		} else {
			processedData = unmarshaled
			logDataStr = jsonDataStr
		}
	}

	h.logger.Debug("Sending realtime update", map[string]interface{}{
		"messageType": messageType,
		"data":        logDataStr, // Use properly processed data for logging
	})

	// Call JavaScript callback if available
	jsCallback := js.Global().Get("onRealtimeUpdate")
	if !jsCallback.IsUndefined() && jsCallback.Type() == js.TypeFunction {
		// Create update object with properly processed data
		update := map[string]interface{}{
			"type":      messageType,
			"data":      processedData, // Use processed data (primitives or unmarshaled objects)
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		}

		jsonData, err := json.Marshal(update)
		if err != nil {
			h.logger.Error("Failed to marshal realtime update", err)
			return h.createErrorResponse("Failed to create realtime update")
		}

		jsCallback.Invoke(string(jsonData))
	}

	return js.ValueOf(map[string]interface{}{
		"success": true,
		"message": "Realtime update sent",
	})
}

// CertifyTokenAsync handles token certification requests from JavaScript
func (h *Handler) CertifyTokenAsync(this js.Value, args []js.Value) any {
	defer func() {
		if r := recover(); r != nil {
			h.logger.Error("Panic in CertifyTokenAsync", fmt.Errorf("%v", r), map[string]interface{}{
				"stack": string(debug.Stack()),
			})
			js.Global().Get("console").Call("error", fmt.Sprintf(PanicMsg, r))
		}
	}()

	h.logger.Info("Received token certification request from JavaScript")

	if len(args) != 1 {
		err := fmt.Errorf("invalid number of arguments: expected 1, got %d", len(args))
		h.logger.Error("Invalid arguments", err)
		return js.Global().Get("Promise").Call("reject", h.createErrorResponse(err.Error()))
	}

	// Parse JSON input
	tokenDataJSON := args[0].String()
	h.logger.Debug("Parsing token certification data", map[string]interface{}{
		"jsonLength": len(tokenDataJSON),
	})

	var tokenData struct {
		Token       string `json:"token"`
		CaseNumber  string `json:"caseNumber"`
		Environment string `json:"environment"`
	}

	if err := json.Unmarshal([]byte(tokenDataJSON), &tokenData); err != nil {
		h.logger.Error("Failed to parse token data JSON", err)
		return js.Global().Get("Promise").Call("reject",
			h.createErrorResponse(fmt.Sprintf("Failed to parse token data: %v", err)))
	}

	// Validate token data
	if tokenData.Token == "" {
		return js.Global().Get("Promise").Call("reject", h.createErrorResponse("Token is required"))
	}

	if tokenData.CaseNumber == "" {
		return js.Global().Get("Promise").Call("reject", h.createErrorResponse("Case number is required"))
	}

	// Validate case number format (simple regex check)
	if !caseNumberRegex.MatchString(tokenData.CaseNumber) {
		return js.Global().Get("Promise").Call("reject", h.createErrorResponse("Invalid case number format"))
	}

	// Rate limiting check
	rateLimitKey := fmt.Sprintf("certify:%s", tokenData.CaseNumber)
	if !h.rateLimiter.Allow(rateLimitKey) {
		h.logger.Warn("Rate limit exceeded for token certification", map[string]interface{}{
			"rateLimitKey": rateLimitKey,
			"caseNumber":   tokenData.CaseNumber,
		})
		return js.Global().Get("Promise").Call("reject", h.createErrorResponse("Rate limit exceeded. Please try again later."))
	}

	h.logger.Info("Token data validated successfully", map[string]interface{}{
		"caseNumber":  tokenData.CaseNumber,
		"environment": tokenData.Environment,
	})

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Create channels for async processing
	resultCh := make(chan map[string]interface{}, 1)
	errCh := make(chan error, 1)

	// Process token certification asynchronously
	go func() {
		defer cancel()

		// Validate token against case number (simple validation logic)
		h.logger.Info("Validating token against case number", map[string]interface{}{
			"caseNumber": tokenData.CaseNumber,
			"tokenHash":  generateSecureTokenHash(tokenData.Token), // Log secure hash instead of raw token
		})

		// Simple token validation logic (in production, this would be more sophisticated)
		isValidToken := h.validateToken(tokenData.Token, tokenData.CaseNumber)
		if !isValidToken {
			errCh <- fmt.Errorf("invalid token for case number")
			return
		}

		// Generate verification ID using secure token generation
		verificationID, err := security.GenerateSecureToken(tokenData.CaseNumber)
		if err != nil {
			h.logger.Error("Failed to generate verification ID", err)
			// Fallback to timestamp-based ID
			verificationID = fmt.Sprintf("CERT-%d", time.Now().Unix())
		}

		// Generate dynamic case details based on case number
		caseDetails := h.generateCaseDetails(tokenData.CaseNumber, tokenData.Environment)

		// Create certification result
		result := map[string]interface{}{
			"isValid":        true,
			"caseStatus":     caseDetails["Current Status"],
			"lastUpdated":    time.Now().UTC().Format(time.RFC3339),
			"caseDetails":    caseDetails,
			"verificationId": verificationID,
		}

		// Send realtime update
		h.SendRealtimeUpdate(js.Null(), []js.Value{
			js.ValueOf("token_certified"),
			js.ValueOf(map[string]interface{}{
				"caseNumber":     tokenData.CaseNumber,
				"verificationId": verificationID,
				"timestamp":      time.Now().UTC().Format(time.RFC3339),
			}),
		})

		// Send result through channel
		resultCh <- result
	}()

	// Return a Promise
	return h.createPromise(func(resolve, reject js.Value) {
		select {
		case result := <-resultCh:
			h.logger.Info("Token certification completed successfully", map[string]interface{}{
				"caseNumber": tokenData.CaseNumber,
			})

			// Create success response
			jsonData, err := json.Marshal(result)
			if err != nil {
				h.logger.Error("Failed to marshal certification result", err)
				reject.Invoke(h.createErrorResponse("Failed to create certification result"))
				return
			}

			resolve.Invoke(js.ValueOf(string(jsonData)))
		case err := <-errCh:
			h.logger.Error("Token certification failed", err, map[string]interface{}{
				"caseNumber": tokenData.CaseNumber,
			})
			reject.Invoke(h.createErrorResponse(err.Error()))
		case <-ctx.Done():
			err := ctx.Err()
			h.logger.Error("Token certification timeout", err, map[string]interface{}{
				"caseNumber": tokenData.CaseNumber,
			})
			reject.Invoke(h.createErrorResponse("Token certification timeout"))
		}
	})
}

// validateToken performs comprehensive cryptographic token validation
func (h *Handler) validateToken(token, caseNumber string) bool {
	// Rate limiting check for validation attempts
	if !h.validationLimiter.Allow("token_validation") {
		h.logger.Warn("Token validation rate limit exceeded", map[string]interface{}{
			"action": "token_validation",
		})
		return false
	}

	// Basic input validation
	if len(token) == 0 {
		h.logger.Info("Token validation failed: empty token", map[string]interface{}{
			"caseNumber": caseNumber,
		})
		return false
	}

	if len(caseNumber) != 13 {
		h.logger.Info("Token validation failed: invalid case number format", map[string]interface{}{
			"caseNumber":  caseNumber,
			"tokenLength": len(token),
		})
		return false
	}

	// Parse and validate JWT
	claims, tokenID, err := h.parseAndValidateJWT(token)
	if err != nil {
		h.logger.Info("Token validation failed: JWT parsing/validation error", map[string]interface{}{
			"caseNumber": caseNumber,
			"error":      err.Error(),
		})
		return false
	}

	// Validate claims
	if !h.validateClaims(claims, caseNumber) {
		h.logger.Info("Token validation failed: claims validation error", map[string]interface{}{
			"caseNumber": caseNumber,
			"subject":    claims.Subject,
			"issuer":     claims.Issuer,
			"audience":   claims.Audience,
		})
		return false
	}

	// Check token revocation if enabled
	if h.tokenConfig.EnableRevocation && h.tokenStore.IsRevoked(tokenID) {
		h.logger.Info("Token validation failed: token revoked", map[string]interface{}{
			"caseNumber": caseNumber,
			"tokenID":    tokenID,
		})
		return false
	}

	// Check if token is in valid token list (if using allowlist)
	if h.tokenStore.IsValid(tokenID) {
		h.logger.Info("Token validation failed: token not in valid list", map[string]interface{}{
			"caseNumber": caseNumber,
			"tokenID":    tokenID,
		})
		return false
	}

	h.logger.Info("Token validation successful", map[string]interface{}{
		"caseNumber": caseNumber,
		"tokenID":    tokenID,
		"expiresAt":  time.Unix(claims.ExpiresAt, 0),
	})

	return true
}

// RevokeToken revokes a token by ID
func (h *Handler) RevokeToken(tokenID string) {
	if store, ok := h.tokenStore.(*InMemoryTokenStore); ok {
		store.RevokeToken(tokenID)
		h.logger.Info("Token revoked", map[string]interface{}{
			"tokenID": tokenID,
		})
	}
}

// AddValidToken adds a token to the valid token list
func (h *Handler) AddValidToken(tokenID string, expiresAt time.Time) {
	if store, ok := h.tokenStore.(*InMemoryTokenStore); ok {
		store.AddValidToken(tokenID, expiresAt)
		h.logger.Info("Token added to valid list", map[string]interface{}{
			"tokenID":   tokenID,
			"expiresAt": expiresAt,
		})
	}
}

// GetTokenValidationStats returns validation statistics
func (h *Handler) GetTokenValidationStats() map[string]interface{} {
	return map[string]interface{}{
		"config": map[string]interface{}{
			"issuer":           h.tokenConfig.Issuer,
			"audience":         h.tokenConfig.Audience,
			"clockSkew":        h.tokenConfig.ClockSkew,
			"enableRevocation": h.tokenConfig.EnableRevocation,
		},
	}
}

// parseAndValidateJWT parses and validates JWT signature
func (h *Handler) parseAndValidateJWT(token string) (*JWTClaims, string, error) {
	// Split JWT into parts
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, "", fmt.Errorf("invalid JWT format: expected 3 parts, got %d", len(parts))
	}

	// Decode header
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode JWT header: %w", err)
	}

	var header map[string]interface{}
	if err := json.Unmarshal(headerJSON, &header); err != nil {
		return nil, "", fmt.Errorf("failed to parse JWT header: %w", err)
	}

	// Verify algorithm
	if alg, ok := header["alg"].(string); !ok || alg != JWTAlgorithm {
		return nil, "", fmt.Errorf("unsupported JWT algorithm: expected %s, got %v", JWTAlgorithm, header["alg"])
	}

	// Decode payload
	payloadJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode JWT payload: %w", err)
	}

	var claims JWTClaims
	if err := json.Unmarshal(payloadJSON, &claims); err != nil {
		return nil, "", fmt.Errorf("failed to parse JWT claims: %w", err)
	}

	// Verify signature using constant-time comparison
	expectedSignature := h.generateSignature(parts[0] + "." + parts[1])
	actualSignature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode JWT signature: %w", err)
	}

	if !hmac.Equal(expectedSignature, actualSignature) {
		return nil, "", fmt.Errorf("JWT signature verification failed")
	}

	// Generate token ID from claims (using subject + issued at for uniqueness)
	tokenID := fmt.Sprintf("%s-%d", claims.Subject, claims.IssuedAt)

	return &claims, tokenID, nil
}

// validateClaims validates JWT claims
func (h *Handler) validateClaims(claims *JWTClaims, expectedCaseNumber string) bool {
	now := time.Now()

	// Validate issuer
	if claims.Issuer != h.tokenConfig.Issuer {
		return false
	}

	// Validate audience
	if claims.Audience != h.tokenConfig.Audience {
		return false
	}

	// Validate expiration with clock skew tolerance
	expirationTime := time.Unix(claims.ExpiresAt, 0)
	if now.After(expirationTime.Add(h.tokenConfig.ClockSkew)) {
		return false
	}

	// Validate issued at (not too far in the future)
	issuedTime := time.Unix(claims.IssuedAt, 0)
	if issuedTime.After(now.Add(h.tokenConfig.ClockSkew)) {
		return false
	}

	// Validate case number matches
	if claims.CaseNumber != expectedCaseNumber {
		return false
	}

	// Validate case number format
	if !h.isValidCaseNumberFormat(claims.CaseNumber) {
		return false
	}

	return true
}

// generateSignature generates HMAC signature for JWT
func (h *Handler) generateSignature(data string) []byte {
	mac := hmac.New(sha256.New, []byte(h.tokenConfig.SigningKey))
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

// isValidCaseNumberFormat validates USCIS case number format
func (h *Handler) isValidCaseNumberFormat(caseNumber string) bool {
	// USCIS case numbers are typically 3 letters followed by 10 digits
	return caseNumberRegex.MatchString(caseNumber)
}

// parseDigit safely parses a single digit character to integer
func (h *Handler) parseDigit(digit byte) (int, error) {
	if digit < '0' || digit > '9' {
		return 0, fmt.Errorf("invalid digit: %c", digit)
	}
	return int(digit - '0'), nil
}

// safeGetDigit safely gets a digit value from caseDigits with bounds checking
func (h *Handler) safeGetDigit(caseDigits string, index int, defaultValue int) int {
	if index >= len(caseDigits) {
		return defaultValue
	}
	if digit, err := h.parseDigit(caseDigits[index]); err == nil {
		return digit
	}
	return defaultValue
}

// generateCaseDetails creates dynamic case details based on case number
func (h *Handler) generateCaseDetails(caseNumber, environment string) map[string]string {
	const (
		caseApproved = "Case Was Approved"
		caseReview   = "Case Is Being Actively Reviewed"
		caseRFE      = "Request for Evidence Was Sent"
		caseTransfer = "Case Was Transferred"
		dateFormat   = "%04d-%02d-%02d"
	)

	// Extract information from case number to make it more realistic
	casePrefix := caseNumber[:3]
	caseDigits := caseNumber[3:]

	// Determine processing center based on case prefix
	var processingCenter string
	switch casePrefix {
	case "ABC":
		processingCenter = "Texas Service Center"
	case "DEF":
		processingCenter = "California Service Center"
	case "GHI":
		processingCenter = "Nebraska Service Center"
	case "JKL":
		processingCenter = "Vermont Service Center"
	default:
		processingCenter = "National Benefits Center"
	}

	// Generate priority date from case digits with validation
	baseYear := 2020
	var priorityDate string

	// Validate caseDigits length and content
	if len(caseDigits) < 3 {
		h.logger.Warn("Case number too short for date generation, using defaults", map[string]interface{}{
			"caseNumber": caseNumber,
			"length":     len(caseDigits),
		})
		// Use safe defaults
		priorityDate = fmt.Sprintf(dateFormat, baseYear, 1, 1)
	} else {
		// Safely parse digits with validation
		yearDigit, err1 := h.parseDigit(caseDigits[0])
		monthDigit, err2 := h.parseDigit(caseDigits[1])
		dayDigit, err3 := h.parseDigit(caseDigits[2])

		if err1 != nil || err2 != nil || err3 != nil {
			h.logger.Warn("Invalid digits in case number, using defaults", map[string]interface{}{
				"caseNumber": caseNumber,
				"errors":     []string{err1.Error(), err2.Error(), err3.Error()},
			})
			// Use safe defaults
			priorityDate = fmt.Sprintf(dateFormat, baseYear, 1, 1)
		} else {
			// Safe arithmetic with validated digits
			year := baseYear + yearDigit*2 // 2020, 2022, 2024, etc.
			month := monthDigit*3 + 1      // 1, 4, 7, 10
			// Clamp month to valid range 1-12
			if month < 1 {
				month = 1
			} else if month > 12 {
				month = 12
			}

			day := dayDigit*3 + 1 // 1, 4, 7, 10, 13, 16, 19, 22, 25, 28
			// Clamp day to valid range 1-28 (safe for all months)
			if day < 1 {
				day = 1
			} else if day > 28 {
				day = 28
			}

			priorityDate = fmt.Sprintf(dateFormat, year, month, day)
		}
	}

	// Determine case status based on environment and case number
	var currentStatus string
	var approvalDate string

	if environment == "production" {
		// In production, mix of statuses
		statusOptions := []string{caseApproved, caseReview, caseRFE, caseTransfer}
		statusDigit := h.safeGetDigit(caseDigits, 0, 0)
		statusIndex := statusDigit % len(statusOptions)
		currentStatus = statusOptions[statusIndex]

		if currentStatus == caseApproved {
			// Generate approval date within last 6 months using safe digit parsing
			monthOffset := h.safeGetDigit(caseDigits, 1, 1)
			dayOffset := h.safeGetDigit(caseDigits, 2, 1)
			approvalTime := time.Now().AddDate(0, -monthOffset, -dayOffset)
			approvalDate = approvalTime.Format("2006-01-02")
		}
	} else {
		// In development, mostly approved for testing
		currentStatus = caseApproved
		dayOffset := h.safeGetDigit(caseDigits, 0, 1)
		approvalDate = time.Now().AddDate(0, -1, -dayOffset).Format("2006-01-02")
	}

	// Determine case type based on case number pattern with safe digit checking
	var caseType string
	firstDigit := h.safeGetDigit(caseDigits, 0, 0)
	secondDigit := h.safeGetDigit(caseDigits, 1, 0)
	switch {
	case firstDigit >= 5:
		caseType = "I-485 Application to Register Permanent Residence"
	case secondDigit >= 5:
		caseType = "I-130 Petition for Alien Relative"
	default:
		caseType = "I-765 Application for Employment Authorization"
	}

	return map[string]string{
		"Case Type":            caseType,
		"Priority Date":        priorityDate,
		"Processing Center":    processingCenter,
		"Current Status":       currentStatus,
		"Approval Notice Date": approvalDate,
	}
}

// RegisterFunctions registers all WASM functions with JavaScript
func (h *Handler) RegisterFunctions() {
	h.logger.Info("Registering WASM functions with JavaScript")

	// Register the main processing function
	js.Global().Set("goProcessCredentials", js.FuncOf(h.ProcessCredentialsAsync))

	// Register token certification function
	js.Global().Set("goCertifyToken", js.FuncOf(h.CertifyTokenAsync))

	// Register a health check function
	js.Global().Set("goHealthCheck", js.FuncOf(h.HealthCheck))

	// Register real-time update function
	js.Global().Set("goSendRealtimeUpdate", js.FuncOf(h.SendRealtimeUpdate))

	h.logger.Info("WASM functions registered successfully")
}
