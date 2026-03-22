package delivery

import (
	"math"
	"math/rand"
	"time"
)

const (
	BaseDelay  = 1 * time.Second  // Initial retry delay
	MaxDelay   = 5 * time.Minute  // Maximum retry delay cap
	JitterMax  = 1 * time.Second  // Maximum random jitter
	MaxRetries = 5                // Default max retries before DLQ
)

// CalculateBackoff returns the next retry delay using exponential backoff with jitter
// Formula: min(base * 2^attempt, maxDelay) + random_jitter(0, jitterMax)
func CalculateBackoff(attempt int) time.Duration {
	// Exponential: base * 2^attempt
	delay := float64(BaseDelay) * math.Pow(2, float64(attempt))

	// Cap at max delay
	if delay > float64(MaxDelay) {
		delay = float64(MaxDelay)
	}

	// Add jitter: random value between 0 and JitterMax
	jitter := time.Duration(rand.Int63n(int64(JitterMax)))

	return time.Duration(delay) + jitter
}

// NextRetryTime calculates when the next retry should happen
func NextRetryTime(attempt int) time.Time {
	return time.Now().UTC().Add(CalculateBackoff(attempt))
}