package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds application configuration
type Config struct {
	USCIS USCISConfig
	HTTP  HTTPConfig
	Retry RetryConfig
}

// USCISConfig holds USCIS API configuration
type USCISConfig struct {
	DevelopmentURL string
	StagingURL     string
	ProductionURL  string
	DefaultTimeout time.Duration
}

// HTTPConfig holds HTTP client configuration
type HTTPConfig struct {
	Timeout         time.Duration
	MaxIdleConns    int
	IdleConnTimeout time.Duration
}

// RetryConfig holds retry configuration
type RetryConfig struct {
	MaxAttempts int
	BaseDelay   time.Duration
	MaxDelay    time.Duration
}

// Load loads configuration from environment variables
func Load() *Config {
	return &Config{
		USCIS: USCISConfig{
			DevelopmentURL: getEnv("USCIS_DEV_URL", "https://api-int.uscis.gov"),
			StagingURL:     getEnv("USCIS_STAGING_URL", "https://api-staging.uscis.gov"),
			ProductionURL:  getEnv("USCIS_PROD_URL", "https://api.uscis.gov"),
			DefaultTimeout: getDurationEnv("USCIS_TIMEOUT", 30*time.Second),
		},
		HTTP: HTTPConfig{
			Timeout:         getDurationEnv("HTTP_TIMEOUT", 30*time.Second),
			MaxIdleConns:    getIntEnv("HTTP_MAX_IDLE_CONNS", 10),
			IdleConnTimeout: getDurationEnv("HTTP_IDLE_TIMEOUT", 30*time.Second),
		},
		Retry: RetryConfig{
			MaxAttempts: getIntEnv("RETRY_MAX_ATTEMPTS", 3),
			BaseDelay:   getDurationEnv("RETRY_BASE_DELAY", 1*time.Second),
			MaxDelay:    getDurationEnv("RETRY_MAX_DELAY", 30*time.Second),
		},
	}
}

// Helper functions
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
