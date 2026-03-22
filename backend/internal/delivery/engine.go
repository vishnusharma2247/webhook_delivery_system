package delivery

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/webhook-delivery-system/backend/internal/db"
	redisstore "github.com/webhook-delivery-system/backend/internal/redis"
)

type Engine struct {
	repo       *db.Repository
	retryStore *redisstore.RetryStore
	httpClient *http.Client
}

// NewEngine creates a new delivery engine
func NewEngine(repo *db.Repository, retryStore *redisstore.RetryStore) *Engine {
	return &Engine{
		repo:       repo,
		retryStore: retryStore,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// DeliverEvent creates delivery records for all matching subscriptions and attempts delivery
func (e *Engine) DeliverEvent(ctx context.Context, eventID uuid.UUID, eventType string, payload string) error {
	subs, err := e.repo.GetActiveSubscriptionsForEventType(eventType)
	if err != nil {
		return fmt.Errorf("failed to get subscriptions: %w", err)
	}

	for _, sub := range subs {
		delivery := &db.Delivery{
			ID:             uuid.New(),
			SubscriptionID: sub.ID,
			EventID:        eventID,
			EventType:      eventType,
			Payload:        payload,
			Status:         db.StatusPending,
			Attempts:       0,
			MaxRetries:     MaxRetries,
			CreatedAt:      time.Now().UTC(),
		}

		if err := e.repo.CreateDelivery(delivery); err != nil {
			log.Printf("Failed to create delivery for subscription %s: %v", sub.ID, err)
			continue
		}

		// Attempt delivery
		e.AttemptDelivery(ctx, delivery, &sub)
	}

	return nil
}

// AttemptDelivery tries to deliver a webhook to the subscriber URL
func (e *Engine) AttemptDelivery(ctx context.Context, delivery *db.Delivery, sub *db.Subscription) {
	delivery.Attempts++
	now := time.Now().UTC()
	delivery.LastAttemptAt = &now

	// Build request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.URL, bytes.NewBufferString(delivery.Payload))
	if err != nil {
		e.handleFailure(ctx, delivery, sub, fmt.Sprintf("failed to create request: %v", err), 0)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Webhook-Delivery-ID", delivery.ID.String())
	req.Header.Set("X-Webhook-Event-ID", delivery.EventID.String())
	req.Header.Set("X-Webhook-Event-Type", delivery.EventType)

	// Sign payload with HMAC
	if sub.Secret != "" {
		signature := SignPayload([]byte(delivery.Payload), sub.Secret)
		req.Header.Set("X-Webhook-Signature", signature)
	}

	// Execute request
	resp, err := e.httpClient.Do(req)
	if err != nil {
		e.handleFailure(ctx, delivery, sub, fmt.Sprintf("request error: %v", err), 0)
		return
	}
	defer resp.Body.Close()

	// Read response body (limited)
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	respBody := string(body)
	delivery.ResponseCode = &resp.StatusCode
	delivery.ResponseBody = &respBody

	// Check success (2xx)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		delivery.Status = db.StatusDelivered
		delivery.NextRetryAt = nil
		if err := e.repo.UpdateDeliveryStatus(delivery); err != nil {
			log.Printf("Failed to update delivery status: %v", err)
		}
		// Remove from retry set if it was there
		e.retryStore.AckRetry(ctx, delivery.ID.String())
		log.Printf(" Delivered %s to %s (attempt %d, status %d)", delivery.ID, sub.URL, delivery.Attempts, resp.StatusCode)
	} else {
		e.handleFailure(ctx, delivery, sub, fmt.Sprintf("HTTP %d: %s", resp.StatusCode, respBody), resp.StatusCode)
	}
}

// handleFailure processes a failed delivery attempt
func (e *Engine) handleFailure(ctx context.Context, delivery *db.Delivery, sub *db.Subscription, reason string, statusCode int) {
	if statusCode != 0 {
		delivery.ResponseCode = &statusCode
	}

	if delivery.Attempts >= delivery.MaxRetries {
		// Promote to DLQ
		delivery.Status = db.StatusDLQ
		delivery.NextRetryAt = nil
		if err := e.repo.UpdateDeliveryStatus(delivery); err != nil {
			log.Printf("Failed to update delivery status: %v", err)
		}
		if err := e.repo.MoveToDLQ(delivery, reason, sub.URL); err != nil {
			log.Printf("Failed to move to DLQ: %v", err)
		}
		e.retryStore.AckRetry(ctx, delivery.ID.String())
		log.Printf(" DLQ: delivery %s after %d attempts: %s", delivery.ID, delivery.Attempts, reason)
	} else {
		// Schedule retry with exponential backoff + jitter
		nextRetry := NextRetryTime(delivery.Attempts)
		delivery.Status = db.StatusFailed
		delivery.NextRetryAt = &nextRetry
		if err := e.repo.UpdateDeliveryStatus(delivery); err != nil {
			log.Printf("Failed to update delivery status: %v", err)
		}
		if err := e.retryStore.ScheduleRetry(ctx, delivery.ID.String(), nextRetry); err != nil {
			log.Printf("Failed to schedule retry: %v", err)
		}
		log.Printf(" Retry scheduled for delivery %s (attempt %d/%d, next at %s)",
			delivery.ID, delivery.Attempts, delivery.MaxRetries, nextRetry.Format(time.RFC3339))
	}
}

// RetryDelivery retries a specific delivery by ID
func (e *Engine) RetryDelivery(ctx context.Context, deliveryID uuid.UUID) error {
	delivery, err := e.repo.GetDelivery(deliveryID)
	if err != nil {
		return fmt.Errorf("delivery not found: %w", err)
	}

	sub, err := e.repo.GetSubscription(delivery.SubscriptionID)
	if err != nil {
		return fmt.Errorf("subscription not found: %w", err)
	}

	// Remove from retry store before re-attempting
	e.retryStore.AckRetry(ctx, deliveryID.String())

	e.AttemptDelivery(ctx, delivery, sub)
	return nil
}