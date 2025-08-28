package ratelimit

import (
	"sync"
	"time"
)

// RateLimiter implements a simple in-memory rate limiter
type RateLimiter struct {
	mu          sync.Mutex
	requests    map[string][]time.Time
	maxRequests int
	window      time.Duration
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxRequests int, window time.Duration) *RateLimiter {
	if maxRequests <= 0 {
		maxRequests = 1
	}
	if window <= 0 {
		window = time.Minute
	}
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

	// Always persist the pruned slice to prevent memory leaks
	if len(validRequests) > 0 {
		rl.requests[identifier] = validRequests
	} else {
		// Release memory by setting to nil when no valid requests remain
		delete(rl.requests, identifier)
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

	// Filter out old timestamps and update the map
	var validRequests []time.Time
	for _, reqTime := range requests {
		if now.Sub(reqTime) < rl.window {
			validRequests = append(validRequests, reqTime)
		}
	}

	// Update the map with filtered requests or delete if empty
	if len(validRequests) > 0 {
		rl.requests[identifier] = validRequests
	} else {
		delete(rl.requests, identifier)
	}

	// Compute remaining requests
	validCount := len(validRequests)
	if validCount >= rl.maxRequests {
		return 0
	}

	return rl.maxRequests - validCount
}
