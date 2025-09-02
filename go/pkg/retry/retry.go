package retry

import (
	"context"
	"time"
)

// Config holds retry configuration
type Config struct {
	MaxAttempts   int
	BaseDelay     time.Duration
	MaxDelay      time.Duration
	BackoffFactor float64
}

// DefaultConfig returns default retry configuration
func DefaultConfig() *Config {
	return &Config{
		MaxAttempts:   3,
		BaseDelay:     1 * time.Second,
		MaxDelay:      30 * time.Second,
		BackoffFactor: 2.0,
	}
}

// Do performs an operation with retry logic
func Do(ctx context.Context, config *Config, operation func() error) error {
	var lastErr error

	for attempt := 0; attempt < config.MaxAttempts; attempt++ {
		// Check context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Execute operation
		if err := operation(); err == nil {
			return nil
		} else {
			lastErr = err
		}

		// Don't sleep on last attempt
		if attempt == config.MaxAttempts-1 {
			break
		}

		// Calculate delay
		delay := time.Duration(float64(config.BaseDelay) *
			float64(config.BackoffFactor*float64(attempt)))
		if delay > config.MaxDelay {
			delay = config.MaxDelay
		}

		// Wait with context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
		}
	}

	return lastErr
}
