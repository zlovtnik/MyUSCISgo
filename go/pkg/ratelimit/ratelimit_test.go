package ratelimit

import (
	"testing"
	"time"
)

const (
	testClientID     = "test-client"
	differentClientID = "different-client"
	client1ID        = "client1"
	client2ID        = "client2"
)

func TestNewRateLimiter(t *testing.T) {
	rl := NewRateLimiter(5, time.Minute)

	if rl.maxRequests != 5 {
		t.Errorf("Expected maxRequests to be 5, got %d", rl.maxRequests)
	}

	if rl.window != time.Minute {
		t.Errorf("Expected window to be 1 minute, got %v", rl.window)
	}

	if rl.requests == nil {
		t.Error("Expected requests map to be initialized")
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

	// Wait for window to expire
	time.Sleep(150 * time.Millisecond)

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
