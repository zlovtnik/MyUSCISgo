package uscis

import (
	"context"
	"testing"
)

const (
	testBaseURL      = "https://api.uscis.gov"
	testTokenURL     = "https://auth.uscis.gov"
	testClientID     = "test-client-id"
	testClientSecret = "test-client-secret"
	testScope        = "read"
)

func TestNewClient(t *testing.T) {
	t.Run("nil oauthConfig", func(t *testing.T) {
		_, err := NewClient(testBaseURL, nil)
		if err == nil {
			t.Error("expected error for nil oauthConfig")
		}
	})

	t.Run("empty client ID", func(t *testing.T) {
		config := &OAuthConfig{
			TokenURL:     testTokenURL,
			ClientID:     "",
			ClientSecret: testClientSecret,
			Scope:        testScope,
		}
		_, err := NewClient(testBaseURL, config)
		if err == nil {
			t.Error("expected error for empty client ID")
		}
	})

	t.Run("valid config", func(t *testing.T) {
		config := &OAuthConfig{
			TokenURL:     testTokenURL,
			ClientID:     testClientID,
			ClientSecret: testClientSecret,
			Scope:        testScope,
		}
		client, err := NewClient(testBaseURL, config)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
		if client == nil {
			t.Error("expected non-nil client")
		}
	})
}

func TestClientGetOAuthTokenNilConfig(t *testing.T) {
	client := &Client{oauthConfig: nil}
	_, err := client.GetOAuthToken(context.Background())
	if err == nil {
		t.Error("expected error with nil oauthConfig")
	}
}

func TestClientRefreshOAuthTokenNilConfig(t *testing.T) {
	client := &Client{oauthConfig: nil}
	_, err := client.RefreshOAuthToken(context.Background(), "refresh-token")
	if err == nil {
		t.Error("expected error with nil oauthConfig")
	}
}
