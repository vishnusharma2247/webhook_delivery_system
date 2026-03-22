package db

import (
	"time"

	"github.com/google/uuid"
)

// DeliveryStatus represents the state of a webhook delivery
type DeliveryStatus string

const (
	StatusPending   DeliveryStatus = "pending"
	StatusDelivered DeliveryStatus = "delivered"
	StatusFailed    DeliveryStatus = "failed"
	StatusDLQ       DeliveryStatus = "dlq"
)

// SubscriptionStatus represents whether a subscription is active
type SubscriptionStatus string

const (
	SubStatusActive SubscriptionStatus = "active"
	SubStatusPaused SubscriptionStatus = "paused"
)

// Subscription represents a webhook subscriber registration
type Subscription struct {
	ID         uuid.UUID          `json:"id"`
	URL        string             `json:"url"`
	Secret     string             `json:"secret,omitempty"`
	EventTypes []string           `json:"event_types"`
	Status     SubscriptionStatus `json:"status"`
	CreatedAt  time.Time          `json:"created_at"`
	UpdatedAt  time.Time          `json:"updated_at"`
}

// Delivery represents a single delivery attempt record
type Delivery struct {
	ID             uuid.UUID      `json:"id"`
	SubscriptionID uuid.UUID      `json:"subscription_id"`
	EventID        uuid.UUID      `json:"event_id"`
	EventType      string         `json:"event_type"`
	Payload        string         `json:"payload"`
	Status         DeliveryStatus `json:"status"`
	Attempts       int            `json:"attempts"`
	MaxRetries     int            `json:"max_retries"`
	LastAttemptAt  *time.Time     `json:"last_attempt_at,omitempty"`
	NextRetryAt    *time.Time     `json:"next_retry_at,omitempty"`
	ResponseCode   *int           `json:"response_code,omitempty"`
	ResponseBody   *string        `json:"response_body,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
}

// DeadLetterEntry represents a delivery that exhausted all retries
type DeadLetterEntry struct {
	ID             uuid.UUID `json:"id"`
	DeliveryID     uuid.UUID `json:"delivery_id"`
	SubscriptionID uuid.UUID `json:"subscription_id"`
	EventID        uuid.UUID `json:"event_id"`
	EventType      string    `json:"event_type"`
	Payload        string    `json:"payload"`
	FailureReason  string    `json:"failure_reason"`
	URL            string    `json:"url"`
	Attempts       int       `json:"attempts"`
	CreatedAt      time.Time `json:"created_at"`
}

// WebhookEvent represents an incoming event to be delivered
type WebhookEvent struct {
	ID        uuid.UUID `json:"id"`
	EventType string    `json:"event_type"`
	Payload   string    `json:"payload"`
}

// DashboardStats holds aggregate statistics for the dashboard
type DashboardStats struct {
	TotalDeliveries   int64   `json:"total_deliveries"`
	SuccessfulCount   int64   `json:"successful_count"`
	FailedCount       int64   `json:"failed_count"`
	PendingCount      int64   `json:"pending_count"`
	DLQCount          int64   `json:"dlq_count"`
	SuccessRate       float64 `json:"success_rate"`
	ActiveSubscriptions int64 `json:"active_subscriptions"`
}