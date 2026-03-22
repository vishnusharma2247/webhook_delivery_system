package delivery

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/webhook-delivery-system/backend/internal/db"
	redisstore "github.com/webhook-delivery-system/backend/internal/redis"
)

// Scheduler polls Redis for due retries and re-dispatches them through the delivery engine
type Scheduler struct {
	repo       *db.Repository
	retryStore *redisstore.RetryStore
	engine     *Engine
	pollInterval time.Duration
}

// NewScheduler creates a new retry scheduler
func NewScheduler(repo *db.Repository, retryStore *redisstore.RetryStore, engine *Engine) *Scheduler {
	return &Scheduler{
		repo:         repo,
		retryStore:   retryStore,
		engine:       engine,
		pollInterval: 1 * time.Second,
	}
}

// Start begins the scheduler loop
func (s *Scheduler) Start(ctx context.Context) {
	log.Println("⏰ Retry scheduler started")
	ticker := time.NewTicker(s.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("Retry scheduler shutting down...")
			return
		case <-ticker.C:
			s.processDueRetries(ctx)
		}
	}
}

func (s *Scheduler) processDueRetries(ctx context.Context) {
	dueIDs, err := s.retryStore.GetDueRetries(ctx, time.Now().UTC())
	if err != nil {
		log.Printf("Error fetching due retries: %v", err)
		return
	}

	for _, idStr := range dueIDs {
		deliveryID, err := uuid.Parse(idStr)
		if err != nil {
			log.Printf("Invalid delivery ID in retry set: %s", idStr)
			s.retryStore.AckRetry(ctx, idStr)
			continue
		}

		delivery, err := s.repo.GetDelivery(deliveryID)
		if err != nil {
			log.Printf("Delivery %s not found, removing from retry set", deliveryID)
			s.retryStore.AckRetry(ctx, idStr)
			continue
		}

		sub, err := s.repo.GetSubscription(delivery.SubscriptionID)
		if err != nil {
			log.Printf("Subscription %s not found for delivery %s", delivery.SubscriptionID, deliveryID)
			s.retryStore.AckRetry(ctx, idStr)
			continue
		}

		// Remove from retry set before re-attempting (will be re-added if it fails again)
		s.retryStore.AckRetry(ctx, idStr)

		log.Printf(" Retrying delivery %s (attempt %d)", deliveryID, delivery.Attempts+1)
		s.engine.AttemptDelivery(ctx, delivery, sub)
	}
}