package api

import (
	"github.com/gin-gonic/gin"
	"github.com/webhook-delivery-system/backend/internal/db"
	"github.com/webhook-delivery-system/backend/internal/delivery"
	kafkapkg "github.com/webhook-delivery-system/backend/internal/kafka"
)

// SetupRouter creates the Gin router with all routes and middleware
func SetupRouter(repo *db.Repository, producer *kafkapkg.Producer, engine *delivery.Engine) *gin.Engine {
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.Use(CORSMiddleware())
	r.Use(RequestIDMiddleware())

	h := NewHandler(repo, producer, engine)

	api := r.Group("/api/v1")
	{
		// Subscriptions
		api.POST("/subscriptions", h.CreateSubscription)
		api.GET("/subscriptions", h.ListSubscriptions)
		api.GET("/subscriptions/:id", h.GetSubscription)
		api.PUT("/subscriptions/:id", h.UpdateSubscription)
		api.DELETE("/subscriptions/:id", h.DeleteSubscription)

		api.POST("/events", h.IngestEvent)

		api.GET("/deliveries", h.ListDeliveries)
		api.GET("/deliveries/:id", h.GetDelivery)

		// Dead Letter Queue
		api.GET("/dlq", h.ListDLQ)
		api.POST("/dlq/:id/retry", h.RetryDLQ)
		api.DELETE("/dlq/:id", h.PurgeDLQ)

		api.GET("/stats", h.GetStats)
	}

	return r
}