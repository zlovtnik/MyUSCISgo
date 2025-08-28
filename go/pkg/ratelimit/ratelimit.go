package ratelimit

import (
	"sync"
	"time"
)

// RateLimiter implements a simple in-memory rate limiter
type RateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	maxRequests int
	window     time.Duration
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxRequests int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		requests:    make(map[string][]time.Time),
		maxRequests: maxRequests,
		window:      window,
	}
}

// Allow checks if a request from the given identifier is allowed
func (rl *RateLimiter) Allow(identifier string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	requests := rl.requests[identifier]

	// Remove old requests outside the window
	var validRequests []time.Time
	for _, reqTime := range requests {
		if now.Sub(reqTime) < rl.window {
			validRequests = append(validRequests, reqTime)
		}
	}

	// Check if under the limit
	if len(validRequests) < rl.maxRequests {
		validRequests = append(validRequests, now)
		rl.requests[identifier] = validRequests
		return true
	}

	return false
}

// GetRemainingRequests returns the number of remaining requests allowed
func (rl *RateLimiter) GetRemainingRequests(identifier string) int {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	requests := rl.requests[identifier]

	// Count valid requests
	validCount := 0
	for _, reqTime := range requests {
		if now.Sub(reqTime) < rl.window {
			validCount++
		}
	}

	if validCount >= rl.maxRequests {
		return 0
	}

	return rl.maxRequests - validCount
}
