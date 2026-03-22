package delivery

import (
	"math"
	"testing"
	"time"
)

func TestCalculateBackoff(t *testing.T) {
	tests := []struct {
		name    string
		attempt int
		minExp  time.Duration
		maxExp  time.Duration
	}{
		{
			name:    "Attempt 0",
			attempt: 0,
			minExp:  BaseDelay,
			maxExp:  BaseDelay + JitterMax,
		},
		{
			name:    "Attempt 1",
			attempt: 1,
			minExp:  BaseDelay * 2,
			maxExp:  (BaseDelay * 2) + JitterMax,
		},
		{
			name:    "Attempt 5",
			attempt: 5,
			minExp:  time.Duration(float64(BaseDelay) * math.Pow(2, 5)), // 32s
			maxExp:  time.Duration(float64(BaseDelay)*math.Pow(2, 5)) + JitterMax,
		},
		{
			name:    "Max Delay Cap",
			attempt: 20, // should hit 5 mins cap
			minExp:  MaxDelay,
			maxExp:  MaxDelay + JitterMax,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Run 100 times to ensure jitter logic stays within bounds
			for i := 0; i < 100; i++ {
				delay := CalculateBackoff(tt.attempt)

				if delay < tt.minExp {
					t.Errorf("expected minimum %v, got %v", tt.minExp, delay)
				}
				if delay > tt.maxExp {
					t.Errorf("expected maximum %v, got %v", tt.maxExp, delay)
				}
			}
		})
	}
}

func TestSignPayload(t *testing.T) {
	secret := "test-secret"
	payload := []byte(`{"event":"test"}`)

	sig1 := SignPayload(payload, secret)
	sig2 := SignPayload(payload, secret)

	if sig1 == "" {
		t.Fatal("expected signature, got empty string")
	}

	if sig1 != sig2 {
		t.Errorf("expected deterministic signature, %s != %s", sig1, sig2)
	}

	// Should start with sha256=
	if sig1[:7] != "sha256=" {
		t.Errorf("expected signature to start with sha256=, got %s", sig1)
	}

	// Sign with different secret
	sig3 := SignPayload(payload, "wrong-secret")
	if sig1 == sig3 {
		t.Error("expected different signature for different secret")
	}
}