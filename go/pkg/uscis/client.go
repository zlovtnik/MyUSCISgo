package uscis

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"MyUSCISgo/pkg/httpclient"
	"MyUSCISgo/pkg/types"
)

// Client represents a USCIS API client
type Client struct {
	httpClient  *httpclient.Client
	oauthConfig *OAuthConfig
}

// OAuthConfig holds OAuth configuration
type OAuthConfig struct {
	TokenURL     string
	ClientID     string
	ClientSecret string
	Scope        string
}

// NewClient creates a new USCIS API client
func NewClient(baseURL string, oauthConfig *OAuthConfig) (*Client, error) {
	if oauthConfig == nil {
		return nil, fmt.Errorf("oauthConfig cannot be nil")
	}
	if oauthConfig.ClientID == "" {
		return nil, fmt.Errorf("oauthConfig.ClientID cannot be empty")
	}
	if oauthConfig.ClientSecret == "" {
		return nil, fmt.Errorf("oauthConfig.ClientSecret cannot be empty")
	}
	if oauthConfig.TokenURL == "" {
		return nil, fmt.Errorf("oauthConfig.TokenURL cannot be empty")
	}

	return &Client{
		httpClient:  httpclient.NewClient(baseURL, 30*time.Second),
		oauthConfig: oauthConfig,
	}, nil
}

// OAuthTokenResponse represents the OAuth token response
type OAuthTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	RefreshToken string `json:"refresh_token,omitempty"`
}

// CaseStatusResponse represents a case status response
type CaseStatusResponse struct {
	CaseNumber       string    `json:"case_number"`
	Status           string    `json:"status"`
	LastUpdated      time.Time `json:"last_updated"`
	CaseType         string    `json:"case_type"`
	PriorityDate     time.Time `json:"priority_date,omitempty"`
	ProcessingCenter string    `json:"processing_center,omitempty"`
}

// GetOAuthToken obtains an OAuth token from USCIS
func (c *Client) GetOAuthToken(ctx context.Context) (*types.OAuthToken, error) {
	if c.oauthConfig == nil {
		return nil, fmt.Errorf("oauthConfig is nil: client not properly initialized")
	}

	// Prepare OAuth request
	oauthReq := &httpclient.Request{
		Method: "POST",
		Path:   "/oauth/token",
		Headers: map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
		},
		Body: map[string]string{
			"grant_type":    "client_credentials",
			"client_id":     c.oauthConfig.ClientID,
			"client_secret": c.oauthConfig.ClientSecret,
			"scope":         c.oauthConfig.Scope,
		},
	}

	// Make request
	resp, err := c.httpClient.Do(ctx, oauthReq)
	if err != nil {
		return nil, fmt.Errorf("OAuth request failed: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("OAuth request failed with status %d: %s", resp.StatusCode, string(resp.Body))
	}

	// Parse response
	var oauthResp OAuthTokenResponse
	if err := json.Unmarshal(resp.Body, &oauthResp); err != nil {
		return nil, fmt.Errorf("failed to parse OAuth response: %w", err)
	}

	// Convert to internal type
	expiresAt := time.Now().Add(time.Duration(oauthResp.ExpiresIn) * time.Second)

	return &types.OAuthToken{
		AccessToken: oauthResp.AccessToken,
		TokenType:   oauthResp.TokenType,
		ExpiresIn:   oauthResp.ExpiresIn,
		ExpiresAt:   expiresAt.Format(time.RFC3339),
		Scope:       oauthResp.Scope,
	}, nil
}

// GetCaseStatus retrieves case status from USCIS
func (c *Client) GetCaseStatus(ctx context.Context, caseNumber string, token *types.OAuthToken) (*CaseStatusResponse, error) {
	// Validate token
	if token == nil || token.AccessToken == "" {
		return nil, fmt.Errorf("invalid or missing OAuth token")
	}

	// Prepare case status request
	caseReq := &httpclient.Request{
		Method: "GET",
		Path:   fmt.Sprintf("/case-status/%s", caseNumber),
		Headers: map[string]string{
			"Authorization": fmt.Sprintf("Bearer %s", token.AccessToken),
			"Accept":        "application/json",
		},
	}

	// Make request
	resp, err := c.httpClient.Do(ctx, caseReq)
	if err != nil {
		return nil, fmt.Errorf("case status request failed: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("case status request failed with status %d: %s", resp.StatusCode, string(resp.Body))
	}

	// Parse response
	var caseResp CaseStatusResponse
	if err := json.Unmarshal(resp.Body, &caseResp); err != nil {
		return nil, fmt.Errorf("failed to parse case status response: %w", err)
	}

	return &caseResp, nil
}

// RefreshOAuthToken refreshes an OAuth token
func (c *Client) RefreshOAuthToken(ctx context.Context, refreshToken string) (*types.OAuthToken, error) {
	if c.oauthConfig == nil {
		return nil, fmt.Errorf("oauthConfig is nil: client not properly initialized")
	}

	// Prepare refresh request
	refreshReq := &httpclient.Request{
		Method: "POST",
		Path:   "/oauth/token",
		Headers: map[string]string{
			"Content-Type": "application/x-www-form-urlencoded",
		},
		Body: map[string]string{
			"grant_type":    "refresh_token",
			"refresh_token": refreshToken,
			"client_id":     c.oauthConfig.ClientID,
			"client_secret": c.oauthConfig.ClientSecret,
		},
	}

	// Make request
	resp, err := c.httpClient.Do(ctx, refreshReq)
	if err != nil {
		return nil, fmt.Errorf("token refresh request failed: %w", err)
	}

	// Check status code
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token refresh failed with status %d: %s", resp.StatusCode, string(resp.Body))
	}

	// Parse response
	var oauthResp OAuthTokenResponse
	if err := json.Unmarshal(resp.Body, &oauthResp); err != nil {
		return nil, fmt.Errorf("failed to parse refresh response: %w", err)
	}

	// Convert to internal type
	expiresAt := time.Now().Add(time.Duration(oauthResp.ExpiresIn) * time.Second)

	return &types.OAuthToken{
		AccessToken: oauthResp.AccessToken,
		TokenType:   oauthResp.TokenType,
		ExpiresIn:   oauthResp.ExpiresIn,
		ExpiresAt:   expiresAt.Format(time.RFC3339),
		Scope:       oauthResp.Scope,
	}, nil
}
