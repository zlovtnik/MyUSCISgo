package logging

import (
	"encoding/json"
	"log"
	"runtime"
	"strings"
	"time"
)

// LogLevel represents the severity level of a log entry
type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
	LogLevelFatal
)

// String returns the string representation of the log level
func (l LogLevel) String() string {
	switch l {
	case LogLevelDebug:
		return "DEBUG"
	case LogLevelInfo:
		return "INFO"
	case LogLevelWarn:
		return "WARN"
	case LogLevelError:
		return "ERROR"
	case LogLevelFatal:
		return "FATAL"
	default:
		return "UNKNOWN"
	}
}

// LogEntry represents a structured log entry
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     string                 `json:"level"`
	Message   string                 `json:"message"`
	Function  string                 `json:"function,omitempty"`
	File      string                 `json:"file,omitempty"`
	Line      int                    `json:"line,omitempty"`
	Fields    map[string]interface{} `json:"fields,omitempty"`
}

// Logger provides structured logging functionality
type Logger struct {
	minLevel LogLevel
}

// NewLogger creates a new logger instance
func NewLogger(minLevel LogLevel) *Logger {
	return &Logger{minLevel: minLevel}
}

// log writes a log entry with the specified level and message
func (l *Logger) log(level LogLevel, message string, fields map[string]interface{}) {
	if level < l.minLevel {
		return
	}

	entry := LogEntry{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Level:     level.String(),
		Message:   message,
		Fields:    fields,
	}

	// Add caller information for Warn and above
	if level >= LogLevelWarn {
		pc, file, line, ok := runtime.Caller(2)
		if ok {
			entry.Function = runtime.FuncForPC(pc).Name()
			entry.File = file
			entry.Line = line
		}
	}

	// Convert to JSON and log
	jsonData, err := json.Marshal(entry)
	if err != nil {
		log.Printf("Failed to marshal log entry: %v", err)
		return
	}

	// Use console methods for better browser integration
	switch level {
	case LogLevelDebug:
		log.Printf("[DEBUG] %s", string(jsonData))
	case LogLevelInfo:
		log.Printf("[INFO] %s", string(jsonData))
	case LogLevelWarn:
		log.Printf("[WARN] %s", string(jsonData))
	case LogLevelError, LogLevelFatal:
		log.Printf("[ERROR] %s", string(jsonData))
	}
}

// Debug logs a debug message
func (l *Logger) Debug(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(LogLevelDebug, message, f)
}

// Info logs an info message
func (l *Logger) Info(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(LogLevelInfo, message, f)
}

// Warn logs a warning message
func (l *Logger) Warn(message string, fields ...map[string]interface{}) {
	var f map[string]interface{}
	if len(fields) > 0 {
		f = fields[0]
	}
	l.log(LogLevelWarn, message, f)
}

// Error logs an error message
func (l *Logger) Error(message string, err error, fields ...map[string]interface{}) {
	f := map[string]interface{}{
		"error": err.Error(),
	}
	if len(fields) > 0 {
		for k, v := range fields[0] {
			f[k] = v
		}
	}
	l.log(LogLevelError, message, f)
}

// Fatal logs a fatal error message
func (l *Logger) Fatal(message string, err error, fields ...map[string]interface{}) {
	f := map[string]interface{}{
		"error": err.Error(),
	}
	if len(fields) > 0 {
		for k, v := range fields[0] {
			f[k] = v
		}
	}
	l.log(LogLevelFatal, message, f)
}

// Global logger instance
var defaultLogger *Logger

func init() {
	defaultLogger = NewLogger(LogLevelInfo)
}

// SetGlobalLevel sets the minimum log level for the global logger
func SetGlobalLevel(level LogLevel) {
	defaultLogger.minLevel = level
}

// Debug logs a debug message using the global logger
func Debug(message string, fields ...map[string]interface{}) {
	defaultLogger.Debug(message, fields...)
}

// Info logs an info message using the global logger
func Info(message string, fields ...map[string]interface{}) {
	defaultLogger.Info(message, fields...)
}

// Warn logs a warning message using the global logger
func Warn(message string, fields ...map[string]interface{}) {
	defaultLogger.Warn(message, fields...)
}

// Error logs an error message using the global logger
func Error(message string, err error, fields ...map[string]interface{}) {
	defaultLogger.Error(message, err, fields...)
}

// Fatal logs a fatal error message using the global logger
func Fatal(message string, err error, fields ...map[string]interface{}) {
	defaultLogger.Fatal(message, err, fields...)
}

// SanitizeLogData removes sensitive information from log data
func SanitizeLogData(data map[string]interface{}) map[string]interface{} {
	sanitized := make(map[string]interface{})

	for k, v := range data {
		// Remove or mask sensitive fields
		switch strings.ToLower(k) {
		case "password", "secret", "token", "key", "credential":
			sanitized[k] = "***REDACTED***"
		default:
			sanitized[k] = v
		}
	}

	return sanitized
}
