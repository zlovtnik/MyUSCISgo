package ratelimit

import (
	"sync"
	"testing"
	"time"
)

const (
	testClientID      = "test-client"
	differentClientID = "different-client"
	client1ID         = "client1"
	client2ID         = "client2"
)

func TestNewRateLimiter(t *testing.T) {
	rl := NewRateLimiter(5, time.Minute)

	// Test behavior instead of private fields
	// Allow 5 requests (the limit)
	for i := 0; i < 5; i++ {
		if !rl.Allow(testClientID) {
			t.Errorf("Request %d should be allowed", i+1)
		}
	}

	// 6th request should be blocked
	if rl.Allow(testClientID) {
		t.Error("6th request should be blocked")
	}

	// Test remaining requests
	remaining := rl.GetRemainingRequests(testClientID)
	if remaining != 0 {
		t.Errorf("Expected 0 remaining requests, got %d", remaining)
	}
}

func TestNewRateLimiterValidation(t *testing.T) {
	tests := []struct {
		name        string
		maxRequests int
		window      time.Duration
		expectedMax int
		expectedWin time.Duration
	}{
		{
			name:        "valid parameters",
			maxRequests: 10,
			window:      time.Minute,
			expectedMax: 10,
			expectedWin: time.Minute,
		},
		{
			name:        "zero maxRequests",
			maxRequests: 0,
			window:      time.Minute,
			expectedMax: 1,
			expectedWin: time.Minute,
		},
		{
			name:        "negative maxRequests",
			maxRequests: -5,
			window:      time.Minute,
			expectedMax: 1,
			expectedWin: time.Minute,
		},
		{
			name:        "zero window",
			maxRequests: 10,
			window:      0,
			expectedMax: 10,
			expectedWin: time.Minute,
		},
		{
			name:        "negative window",
			maxRequests: 10,
			window:      -time.Minute,
			expectedMax: 10,
			expectedWin: time.Minute,
		},
		{
			name:        "both invalid",
			maxRequests: 0,
			window:      0,
			expectedMax: 1,
			expectedWin: time.Minute,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rl := NewRateLimiter(tt.maxRequests, tt.window)

			// Test behavior based on expected validated values
			var expectedAllowed int
			if tt.expectedMax > 0 {
				expectedAllowed = tt.expectedMax
			} else {
				expectedAllowed = 1 // fallback for invalid input
			}

			// Allow requests up to expected limit
			for i := 0; i < expectedAllowed; i++ {
				if !rl.Allow(testClientID) {
					t.Errorf("Request %d should be allowed for %s", i+1, tt.name)
				}
			}

			// Next request should be blocked
			if rl.Allow(testClientID) {
				t.Errorf("Request should be blocked after reaching limit for %s", tt.name)
			}
		})
	}
}

func TestRateLimiterAllow(t *testing.T) {
	rl := NewRateLimiter(3, time.Minute)

	// First 3 requests should be allowed
	for i := 0; i < 3; i++ {
		if !rl.Allow(testClientID) {
			t.Errorf("Request %d should be allowed", i+1)
		}
	}

	// 4th request should be denied
	if rl.Allow(testClientID) {
		t.Error("4th request should be denied")
	}

	// Different client should be allowed
	if !rl.Allow(differentClientID) {
		t.Error("Different client should be allowed")
	}
}

func TestRateLimiterGetRemainingRequests(t *testing.T) {
	rl := NewRateLimiter(5, time.Minute)

	// Initially should have 5 remaining
	remaining := rl.GetRemainingRequests(testClientID)
	if remaining != 5 {
		t.Errorf("Expected 5 remaining requests, got %d", remaining)
	}

	// After 2 requests, should have 3 remaining
	rl.Allow(testClientID)
	rl.Allow(testClientID)
	remaining = rl.GetRemainingRequests(testClientID)
	if remaining != 3 {
		t.Errorf("Expected 3 remaining requests, got %d", remaining)
	}

	// After exceeding limit, should have 0 remaining
	for i := 0; i < 5; i++ {
		rl.Allow(testClientID)
	}
	remaining = rl.GetRemainingRequests(testClientID)
	if remaining != 0 {
		t.Errorf("Expected 0 remaining requests, got %d", remaining)
	}
}

func TestRateLimiterWindowExpiration(t *testing.T) {
	// Use a very short window for testing
	rl := NewRateLimiter(2, 100*time.Millisecond)

	// Use up the limit
	rl.Allow(testClientID)
	rl.Allow(testClientID)

	// Should be blocked
	if rl.Allow(testClientID) {
		t.Error("Request should be blocked after reaching limit")
	}

	// Wait for window to expire with headroom (CI safety)
	time.Sleep(250 * time.Millisecond)

	// Should be allowed again
	if !rl.Allow(testClientID) {
		t.Error("Request should be allowed after window expiration")
	}
}

func TestRateLimiterMultipleClients(t *testing.T) {
	rl := NewRateLimiter(2, time.Minute)

	// Client 1 uses up their limit
	rl.Allow(client1ID)
	rl.Allow(client1ID)

	// Client 2 should still be allowed
	if !rl.Allow(client2ID) {
		t.Error("Client 2 should be allowed")
	}

	// Client 1 should be blocked
	if rl.Allow(client1ID) {
		t.Error("Client 1 should be blocked")
	}

	// Client 2 should still be allowed once more
	if !rl.Allow(client2ID) {
		t.Error("Client 2 should be allowed for second request")
	}

	// Client 2 should now be blocked
	if rl.Allow(client2ID) {
		t.Error("Client 2 should be blocked after 2 requests")
	}
}

func TestRateLimiterConcurrency(t *testing.T) {
	rl := NewRateLimiter(10, time.Minute)
	const numGoroutines = 50
	const requestsPerGoroutine = 5

	// Channel to collect results
	results := make(chan bool, numGoroutines*requestsPerGoroutine)
	var wg sync.WaitGroup

	// Spawn multiple goroutines that all hit the same identifier
	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < requestsPerGoroutine; j++ {
				results <- rl.Allow(testClientID)
			}
		}()
	}

	// Wait for all goroutines to complete
	wg.Wait()
	close(results)

	// Count allowed and blocked requests
	allowed := 0
	blocked := 0
	for result := range results {
		if result {
			allowed++
		} else {
			blocked++
		}
	}

	// With 10 requests allowed per minute and 50 goroutines * 5 requests = 250 total requests,
	// we expect exactly 10 to be allowed and 240 to be blocked
	if allowed != 10 {
		t.Errorf("Expected 10 requests to be allowed, got %d", allowed)
	}

	if blocked != 240 {
		t.Errorf("Expected 240 requests to be blocked, got %d", blocked)
	}

	// Verify remaining requests is 0
	remaining := rl.GetRemainingRequests(testClientID)
	if remaining != 0 {
		t.Errorf("Expected 0 remaining requests after concurrency test, got %d", remaining)
	}
}
