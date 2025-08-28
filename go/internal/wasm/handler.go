//go:build js && wasm

package wasm

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime/debug"
	"syscall/js"
	"time"

	"MyUSCISgo/pkg/logging"
	"MyUSCISgo/pkg/processing"
	"MyUSCISgo/pkg/ratelimit"
	"MyUSCISgo/pkg/types"
	"MyUSCISgo/pkg/validation"
)

	messageType := args[0].String()
	data := args[1]

	// Properly serialize the JavaScript object using JSON.stringify
	jsonStringify := js.Global().Get("JSON").Get("stringify")
	jsonDataStr := jsonStringify.Invoke(data).String()
	
	// Store as json.RawMessage to preserve the original JSON structure
	var rawData json.RawMessage
	if err := json.Unmarshal([]byte(jsonDataStr), &rawData); err != nil {
		h.logger.Error("Failed to unmarshal JSON data", err)
		return h.createErrorResponse("Failed to process data")
	}

	h.logger.Debug("Sending realtime update", map[string]interface{}{
		"messageType": messageType,
		"data":        jsonDataStr, // Use properly serialized JSON string for logging
	})gTimeoutMsg = "Processing timeout"
)

// Handler handles WASM function calls from JavaScript
type Handler struct {
	processor   *processing.Processor
	logger      *logging.Logger
	rateLimiter *ratelimit.RateLimiter
}

// NewHandler creates a new WASM handler
func NewHandler() *Handler {
	return &Handler{
		processor:   processing.NewProcessor(),
		logger:      logging.NewLogger(logging.LogLevelInfo),
		rateLimiter: ratelimit.NewRateLimiter(10, time.Minute), // 10 requests per minute
	}
}

// ProcessCredentialsAsync handles the async processing of credentials from JavaScript
func (h *Handler) ProcessCredentialsAsync(this js.Value, args []js.Value) any {
	defer func() {
		if r := recover(); r != nil {
			h.logger.Fatal("Panic in ProcessCredentialsAsync", fmt.Errorf("%v", r), map[string]interface{}{
				"stack": string(debug.Stack()),
			})
			js.Global().Get("console").Call("error", fmt.Sprintf("Go panic: %v", r))
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
			h.logger.Error("Processing timeout", err, map[string]interface{}{
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
			h.logger.Fatal("Panic in SendRealtimeUpdate", fmt.Errorf("%v", r))
			js.Global().Get("console").Call("error", fmt.Sprintf("Go panic: %v", r))
		}
	}()

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
				"error": err.Error(),
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

// RegisterFunctions registers all WASM functions with JavaScript
func (h *Handler) RegisterFunctions() {
	h.logger.Info("Registering WASM functions with JavaScript")

	// Register the main processing function
	js.Global().Set("goProcessCredentials", js.FuncOf(h.ProcessCredentialsAsync))

	// Register a health check function
	js.Global().Set("goHealthCheck", js.FuncOf(h.HealthCheck))

	// Register real-time update function
	js.Global().Set("goSendRealtimeUpdate", js.FuncOf(h.SendRealtimeUpdate))

	h.logger.Info("WASM functions registered successfully")
}
