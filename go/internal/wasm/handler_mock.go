//go:build !js || !wasm

package wasm

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"MyUSCISgo/pkg/logging"
	"MyUSCISgo/pkg/processing"
	"MyUSCISgo/pkg/types"
	"MyUSCISgo/pkg/validation"
)

// MockJSValue simulates js.Value for non-WASM builds
type MockJSValue struct {
	value interface{}
}

// MockJSFunc simulates js.FuncOf for non-WASM builds
type MockJSFunc struct {
	fn func()
}

// Handler handles WASM function calls from JavaScript (mock version for non-WASM builds)
type Handler struct {
	processor *processing.Processor
	logger    *logging.Logger
}

// NewHandler creates a new WASM handler
func NewHandler() *Handler {
	return &Handler{
		processor: processing.NewProcessor(),
		logger:    logging.NewLogger(logging.LogLevelInfo),
	}
}

// ProcessCredentialsAsync handles the async processing of credentials (mock version)
func (h *Handler) ProcessCredentialsAsync(input string) (string, error) {
	h.logger.Info("Processing credentials (non-WASM mode)")

	var creds types.Credentials
	if err := json.Unmarshal([]byte(input), &creds); err != nil {
		h.logger.Error("Failed to parse credentials JSON", err)
		return "", fmt.Errorf("failed to parse credentials: %w", err)
	}

	// Validate credentials
	if err := validation.ValidateCredentials(&creds); err != nil {
		h.logger.Error("Credential validation failed", err)
		return "", err
	}

	h.logger.Info("Credentials validated successfully", map[string]interface{}{
		"clientId":    creds.ClientID,
		"environment": creds.Environment,
	})

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Process synchronously for non-WASM builds
	result, err := h.processor.ProcessCredentialsSync(ctx, &creds)
	if err != nil {
		h.logger.Error("Processing failed", err)
		return "", err
	}

	response := types.WASMResponse{
		Success: true,
		Result:  result,
	}

	jsonData, err := json.Marshal(response)
	if err != nil {
		h.logger.Error("Failed to marshal response", err)
		return "", fmt.Errorf("failed to create response: %w", err)
	}

	return string(jsonData), nil
}

// RegisterFunctions is a no-op for non-WASM builds
func (h *Handler) RegisterFunctions() {
	h.logger.Info("WASM functions registration skipped (non-WASM build)")
}
