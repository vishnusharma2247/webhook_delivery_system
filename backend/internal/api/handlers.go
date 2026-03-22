package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/webhook-delivery-system/backend/internal/db"
	"github.com/webhook-delivery-system/backend/internal/delivery"
	kafkapkg "github.com/webhook-delivery-system/backend/internal/kafka"
)

// Handler contains all API dependencies
type Handler struct {
	repo     *db.Repository
	producer *kafkapkg.Producer
	engine   *delivery.Engine
}

// NewHandler creates a new API handler
func NewHandler(repo *db.Repository, producer *kafkapkg.Producer, engine *delivery.Engine) *Handler {
	return &Handler{
		repo:     repo,
		producer: producer,
		engine:   engine,
	}
}

// --- Subscription Handlers ---

type createSubscriptionRequest struct {
	URL        string   `json:"url" binding:"required"`
	Secret     string   `json:"secret"`
	EventTypes []string `json:"event_types"`
}

func (h *Handler) CreateSubscription(c *gin.Context) {
	var req createSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	sub := &db.Subscription{
		URL:        req.URL,
		Secret:     req.Secret,
		EventTypes: req.EventTypes,
	}
	if sub.EventTypes == nil {
		sub.EventTypes = []string{}
	}

	if err := h.repo.CreateSubscription(sub); err != nil {
		log.Printf("Error creating subscription: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create subscription"})
		return
	}

	c.JSON(http.StatusCreated, sub)
}

func (h *Handler) ListSubscriptions(c *gin.Context) {
	subs, err := h.repo.ListSubscriptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list subscriptions"})
		return
	}
	if subs == nil {
		subs = []db.Subscription{}
	}
	c.JSON(http.StatusOK, gin.H{"subscriptions": subs})
}

func (h *Handler) GetSubscription(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid subscription ID"})
		return
	}

	sub, err := h.repo.GetSubscription(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	c.JSON(http.StatusOK, sub)
}

type updateSubscriptionRequest struct {
	URL        string   `json:"url"`
	Secret     string   `json:"secret"`
	EventTypes []string `json:"event_types"`
	Status     string   `json:"status"`
}

func (h *Handler) UpdateSubscription(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid subscription ID"})
		return
	}

	sub, err := h.repo.GetSubscription(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "subscription not found"})
		return
	}

	var req updateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.URL != "" {
		sub.URL = req.URL
	}
	if req.Secret != "" {
		sub.Secret = req.Secret
	}
	if req.EventTypes != nil {
		sub.EventTypes = req.EventTypes
	}
	if req.Status != "" {
		sub.Status = db.SubscriptionStatus(req.Status)
	}

	if err := h.repo.UpdateSubscription(sub); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update subscription"})
		return
	}

	c.JSON(http.StatusOK, sub)
}

func (h *Handler) DeleteSubscription(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid subscription ID"})
		return
	}

	if err := h.repo.DeleteSubscription(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "subscription deleted"})
}

// --- Event Handlers ---

type ingestEventRequest struct {
	EventType string      `json:"event_type" binding:"required"`
	Payload   interface{} `json:"payload" binding:"required"`
}

func (h *Handler) IngestEvent(c *gin.Context) {
	var req ingestEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	eventID := uuid.New()

	// Marshal the payload to JSON string
	payloadJSON, err := json.Marshal(req.Payload)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	// Get matching subscriptions to fan-out via Kafka
	subs, err := h.repo.GetActiveSubscriptionsForEventType(req.EventType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to find subscriptions"})
		return
	}

	// Publish a message per subscription for partition-key ordering
	published := 0
	for _, sub := range subs {
		msg := kafkapkg.EventMessage{
			EventID:        eventID.String(),
			EventType:      req.EventType,
			Payload:        string(payloadJSON),
			SubscriptionID: sub.ID.String(),
		}
		if err := h.producer.Publish(c.Request.Context(), msg); err != nil {
			log.Printf("Failed to publish event to Kafka for sub %s: %v", sub.ID, err)
		} else {
			published++
		}
	}

	c.JSON(http.StatusAccepted, gin.H{
		"event_id":      eventID.String(),
		"event_type":    req.EventType,
		"subscriptions": published,
		"message":       "event accepted for delivery",
	})
}

// --- Delivery Handlers ---

func (h *Handler) ListDeliveries(c *gin.Context) {
	status := c.Query("status")
	subscriptionID := c.Query("subscription_id")
	limit := queryInt(c, "limit", 50)
	offset := queryInt(c, "offset", 0)

	deliveries, total, err := h.repo.ListDeliveries(status, subscriptionID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list deliveries"})
		return
	}
	if deliveries == nil {
		deliveries = []db.Delivery{}
	}

	c.JSON(http.StatusOK, gin.H{
		"deliveries": deliveries,
		"total":      total,
		"limit":      limit,
		"offset":     offset,
	})
}

func (h *Handler) GetDelivery(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid delivery ID"})
		return
	}

	d, err := h.repo.GetDelivery(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "delivery not found"})
		return
	}

	c.JSON(http.StatusOK, d)
}

// --- DLQ Handlers ---

func (h *Handler) ListDLQ(c *gin.Context) {
	limit := queryInt(c, "limit", 50)
	offset := queryInt(c, "offset", 0)

	entries, total, err := h.repo.ListDLQ(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list DLQ"})
		return
	}
	if entries == nil {
		entries = []db.DeadLetterEntry{}
	}

	c.JSON(http.StatusOK, gin.H{
		"entries": entries,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

func (h *Handler) RetryDLQ(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid DLQ entry ID"})
		return
	}

	newDelivery, err := h.repo.RetryFromDLQ(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retry DLQ entry: " + err.Error()})
		return
	}

	// Get subscription to attempt delivery
	sub, err := h.repo.GetSubscription(newDelivery.SubscriptionID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "delivery re-queued but subscription not found", "delivery_id": newDelivery.ID})
		return
	}

	// Attempt delivery in background
	go h.engine.AttemptDelivery(c.Request.Context(), newDelivery, sub)

	c.JSON(http.StatusOK, gin.H{"message": "DLQ entry re-queued for delivery", "delivery_id": newDelivery.ID})
}

func (h *Handler) PurgeDLQ(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid DLQ entry ID"})
		return
	}

	if err := h.repo.PurgeDLQ(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to purge DLQ entry"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "DLQ entry purged"})
}

// --- Stats Handler ---

func (h *Handler) GetStats(c *gin.Context) {
	stats, err := h.repo.GetDashboardStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// --- Helpers ---

func queryInt(c *gin.Context, key string, defaultVal int) int {
	v := c.Query(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return n
}