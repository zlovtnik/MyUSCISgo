//go:build integration

package main

import (
	"MyUSCISgo/pkg/processing"
	"MyUSCISgo/pkg/types"
	"context"
	"fmt"
)

func testUSCISIntegration() {
	fmt.Println("Testing USCIS API Integration...")

	// Create a processor
	processor := processing.NewProcessor()

	// Test credentials
	creds := &types.Credentials{
		ClientID:     "test-client-123",
		ClientSecret: "SecurePass7!@#Word",
		Environment:  "development",
	}

	// Test synchronous processing
	fmt.Println("Testing synchronous processing...")
	result, err := processor.ProcessCredentialsSync(context.Background(), creds)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	fmt.Printf("Success! Result: %+v\n", result)
	fmt.Printf("BaseURL: %s\n", result.BaseURL)
	fmt.Printf("AuthMode: %s\n", result.AuthMode)
	fmt.Printf("Config: %+v\n", result.Config)

	if result.OAuthToken != nil {
		fmt.Printf("OAuth Token: %s... (expires: %s)\n",
			result.OAuthToken.AccessToken[:10],
			result.OAuthToken.ExpiresAt)
	}

	fmt.Println("✅ USCIS API Integration test completed successfully!")
}

func main() {
	testUSCISIntegration()
}
