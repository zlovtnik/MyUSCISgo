package validation

import (
	"strings"
	"testing"

	"MyUSCISgo/pkg/types"
)

func TestValidateCredentials(t *testing.T) {
	tests := []struct {
		name        string
		credentials *types.Credentials
		wantErr     bool
		errContains string
	}{
		{
			name: "valid credentials - development",
			credentials: &types.Credentials{
				ClientID:     "test-client-123",
				ClientSecret: "MySecurePass123",
				Environment:  "development",
			},
			wantErr: false,
		},
		{
			name: "valid credentials - staging",
			credentials: &types.Credentials{
				ClientID:     "test-client-456",
				ClientSecret: "AnotherSecurePass456",
				Environment:  "staging",
			},
			wantErr: false,
		},
		{
			name: "valid credentials - production",
			credentials: &types.Credentials{
				ClientID:     "prod-client-789",
				ClientSecret: "ProductionSecurePass789",
				Environment:  "production",
			},
			wantErr: false,
		},
		{
			name: "empty client ID",
			credentials: &types.Credentials{
				ClientID:     "",
				ClientSecret: "MySecurePass123",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "client ID cannot be empty",
		},
		{
			name: "empty client secret",
			credentials: &types.Credentials{
				ClientID:     "test-client-123",
				ClientSecret: "",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "client secret cannot be empty",
		},
		{
			name: "invalid environment",
			credentials: &types.Credentials{
				ClientID:     "test-client-123",
				ClientSecret: "MySecurePass123",
				Environment:  "invalid",
			},
			wantErr:     true,
			errContains: "environment must be one of",
		},
		{
			name: "client ID too short",
			credentials: &types.Credentials{
				ClientID:     "ab",
				ClientSecret: "MySecurePass123",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "must be between 3 and 100 characters",
		},
		{
			name: "client ID too long",
			credentials: &types.Credentials{
				ClientID:     strings.Repeat("a", 101),
				ClientSecret: "MySecurePass123",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "must be between 3 and 100 characters",
		},
		{
			name: "client secret too short",
			credentials: &types.Credentials{
				ClientID:     "test-client-123",
				ClientSecret: "short",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "must be at least 8 characters long",
		},
		{
			name: "client secret too long",
			credentials: &types.Credentials{
				ClientID:     "test-client-123",
				ClientSecret: strings.Repeat("a", 256),
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "must be less than 255 characters",
		},
		{
			name: "client secret without letter",
			credentials: &types.Credentials{
				ClientID:     "test-client-123",
				ClientSecret: "12345678",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "must contain at least one letter and one number",
		},
		{
			name: "client secret without number",
			credentials: &types.Credentials{
				ClientID:     "test-client-123",
				ClientSecret: "abcdefgh",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "must contain at least one letter and one number",
		},
		{
			name: "client ID with invalid characters",
			credentials: &types.Credentials{
				ClientID:     "test client 123",
				ClientSecret: "MySecurePass123",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "must contain only alphanumeric characters",
		},
		{
			name: "special characters in client ID",
			credentials: &types.Credentials{
				ClientID:     "test@client#123",
				ClientSecret: "MySecurePass123",
				Environment:  "development",
			},
			wantErr:     true,
			errContains: "must contain only alphanumeric characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCredentials(tt.credentials)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCredentials() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err != nil && tt.errContains != "" {
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("ValidateCredentials() error = %v, want error containing %v", err, tt.errContains)
				}
			}
		})
	}
}

func TestValidateClientID(t *testing.T) {
	tests := []struct {
		name     string
		clientID string
		wantErr  bool
		errMsg   string
	}{
		{"valid client ID", "test-client-123", false, ""},
		{"valid client ID with underscores", "test_client_123", false, ""},
		{"valid client ID with dash and underscore", "test-client_123", false, ""},
		{"valid alphanumeric", "TestClient123", false, ""},
		{"empty client ID", "", true, "client ID cannot be empty"},
		{"client ID with spaces", "test client", true, "must contain only alphanumeric characters, underscores, or dashes"},
		{"client ID with special chars", "test@client", true, "must contain only alphanumeric characters, underscores, or dashes"},
		{"too short", "ab", true, "must be between 3 and 100 characters"},
		{"too long", strings.Repeat("a", 101), true, "must be between 3 and 100 characters"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateClientID(tt.clientID)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateClientID() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && tt.errMsg != "" && !strings.Contains(err.Error(), tt.errMsg) {
				t.Errorf("ValidateClientID() error = %v, want error containing %v", err, tt.errMsg)
			}
		})
	}
}

func TestValidateClientSecret(t *testing.T) {
	tests := []struct {
		name         string
		clientSecret string
		wantErr      bool
		errContains  string
	}{
		{"valid secret", "MySecurePass123", false, ""},
		{"valid secret with special chars", "MySecurePass!@#123", false, ""},
		{"empty secret", "", true, "client secret cannot be empty"},
		{"too short", "short", true, "must be at least 8 characters long"},
		{"too long", strings.Repeat("a", 256), true, "must be less than 255 characters"},
		{"no letters", "12345678", true, "must contain at least one letter and one number"},
		{"no numbers", "abcdefgh", true, "must contain at least one letter and one number"},
		{"only special chars", "!@#$%^&*", true, "must contain at least one letter and one number"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateClientSecret(tt.clientSecret)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateClientSecret() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
				t.Errorf("ValidateClientSecret() error = %v, want error containing %v", err, tt.errContains)
			}
		})
	}
}

func TestValidateEnvironment(t *testing.T) {
	tests := []struct {
		name        string
		environment string
		wantErr     bool
	}{
		{"development", "development", false},
		{"staging", "staging", false},
		{"production", "production", false},
		{"Development case insensitive", "Development", false},
		{"STAGING case insensitive", "STAGING", false},
		{"invalid environment", "invalid", true},
		{"empty environment", "", true},
		{"random string", "random", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateEnvironment(tt.environment)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateEnvironment() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSanitizeInput(t *testing.T) {
	const jsPayload = "javascript:alert('xss')"
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"normal input", "normal input", "normal input"},
		{"input with script", "<script>alert('xss')</script>", ""},
		{"input with quotes", "\"quoted\" 'single'", "&#34;quoted&#34; &#39;single&#39;"},
		{"input with whitespace", "  input  ", "input"},
		{"empty input", "", ""},
		{"input with newlines", "line1\nline2", "line1line2"},
		{"mixed case javascript protocol", jsPayload, ""},
		{"JavaScript protocol uppercase", "JavaScript:alert('xss')", ""},
		{"multiline script tag", "<SCRIPT>\nalert('xss');\n</SCRIPT>", ""},
		{"multiline script with content", "<script>\n  alert('xss');\n  console.log('test');\n</script>", ""},
		{"onClick attribute", "<div onClick=\"alert('xss')\"></div>", "&lt;div&gt;&lt;/div&gt;"},
		{"onmouseover attribute", "<img onMouseOver=\"alert('xss')\" />", "&lt;img /&gt;"},
		{"javascript in href", "<a href=\"javascript:alert('xss')\">link</a>", "&lt;a href=&#34;&gt;link&lt;/a&gt;"},
		{"vbscript protocol", "vbscript:msgbox('xss')", ""},
		{"data URI", "data:text/html,<script>alert('xss')</script>", "&gt;alert(&#39;xss&#39;)&lt;/script&gt;"},
		{"multiple event handlers", "<div onClick=\"alert(1)\" onMouseOver=\"alert(2)\">test</div>", "&lt;div&gt;test&lt;/div&gt;"},
		{"javascript with single quotes", "javascript:alert('xss')", ""},
		{"javascript with double quotes", "javascript:alert(\"xss\")", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeInput(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeInput() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestSanitizeInputDangerousContentRemoval(t *testing.T) {
	const jsPayload = "javascript:alert('xss')"
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "javascript URI complete removal",
			input:    jsPayload,
			expected: "",
		},
		{
			name:     "javascript URI in href attribute",
			input:    `<a href="` + jsPayload + `">Click me</a>`,
			expected: `&lt;a href=&#34;&gt;Click me&lt;/a&gt;`,
		},
		{
			name:     "javascript URI with complex payload",
			input:    "javascript:(function(){alert('xss');return false;})()",
			expected: "false;})()",
		},
		{
			name:     "vbscript URI removal",
			input:    "vbscript:msgbox('xss')",
			expected: "",
		},
		{
			name:     "data URI removal",
			input:    "data:text/html,<script>alert('xss')</script>",
			expected: "&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
		},
		{
			name:     "file URI removal",
			input:    "file:///etc/passwd",
			expected: "",
		},
		{
			name:     "ftp URI removal",
			input:    "ftp://evil.com/malware.exe",
			expected: "",
		},
		{
			name:     "onClick event handler removal",
			input:    `<button onClick="alert('xss')">Click</button>`,
			expected: `&lt;button&gt;Click&lt;/button&gt;`,
		},
		{
			name:     "onMouseOver event handler removal",
			input:    `<img onMouseOver="alert('xss')" src="image.jpg" />`,
			expected: `&lt;img src=&#34;image.jpg&#34; /&gt;`,
		},
		{
			name:     "multiple event handlers removal",
			input:    `<div onClick="alert(1)" onMouseOver="alert(2)" onLoad="alert(3)">test</div>`,
			expected: `&lt;div&gt;test&lt;/div&gt;`,
		},
		{
			name:     "event handler with single quotes",
			input:    `<a onClick='alert("xss")'>link</a>`,
			expected: `&lt;a&gt;link&lt;/a&gt;`,
		},
		{
			name:     "event handler without quotes",
			input:    `<div onClick=alert('xss')>test</div>`,
			expected: `&lt;div&gt;test&lt;/div&gt;`,
		},
		{
			name:     "mixed dangerous content",
			input:    `<a href="` + jsPayload + `" onClick="alert('xss')">link</a>`,
			expected: `&lt;a href=&#34;&gt;link&lt;/a&gt;`,
		},
		{
			name:     "safe content should remain",
			input:    `<a href="https://example.com">safe link</a>`,
			expected: `&lt;a href=&#34;https://example.com&#34;&gt;safe link&lt;/a&gt;`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeInput(tt.input)
			if result != tt.expected {
				t.Errorf("SanitizeInput() = %q, want %q", result, tt.expected)
			}
		})
	}
}
