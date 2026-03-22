package redis

import (
	"context"
	"fmt"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

const retrySetKey = "webhook:retries"

// RetryStore manages retry scheduling using Redis sorted sets
type RetryStore struct {
	client *goredis.Client
}

// NewRetryStore creates a new RetryStore
func NewRetryStore(client *goredis.Client) *RetryStore {
	return &RetryStore{client: client}
}

// ScheduleRetry adds a delivery to the retry set, scored by next retry timestamp
func (s *RetryStore) ScheduleRetry(ctx context.Context, deliveryID string, nextRetryAt time.Time) error {
	return s.client.ZAdd(ctx, retrySetKey, goredis.Z{
		Score:  float64(nextRetryAt.Unix()),
		Member: deliveryID,
	}).Err()
}

// GetDueRetries returns delivery IDs whose retry time has passed
func (s *RetryStore) GetDueRetries(ctx context.Context, now time.Time) ([]string, error) {
	return s.client.ZRangeByScore(ctx, retrySetKey, &goredis.ZRangeBy{
		Min: "-inf",
		Max: fmt.Sprintf("%d", now.Unix()),
	}).Result()
}

// AckRetry removes a delivery from the retry set after processing
func (s *RetryStore) AckRetry(ctx context.Context, deliveryID string) error {
	return s.client.ZRem(ctx, retrySetKey, deliveryID).Err()
}

// RemoveRetry is an alias for AckRetry
func (s *RetryStore) RemoveRetry(ctx context.Context, deliveryID string) error {
	return s.AckRetry(ctx, deliveryID)
}