package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/webhook-delivery-system/backend/internal/api"
	"github.com/webhook-delivery-system/backend/internal/db"
	"github.com/webhook-delivery-system/backend/internal/delivery"
	kafkapkg "github.com/webhook-delivery-system/backend/internal/kafka"
	redispkg "github.com/webhook-delivery-system/backend/internal/redis"
)

func main() {
	log.Println(" Starting Webhook Delivery System...")

	// --- Initialize Postgres ---
	database, err := db.NewPostgresDB()
	if err != nil {
		log.Fatalf("Failed to connect to Postgres: %v", err)
	}
	defer database.Close()

	// Run migrations
	if err := db.RunMigrations(database); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	repo := db.NewRepository(database)

	// --- Initialize Redis ---
	redisClient := redispkg.NewRedisClient()
	defer redisClient.Close()
	retryStore := redispkg.NewRetryStore(redisClient)

	// --- Initialize Kafka Producer ---
	producer := kafkapkg.NewProducer()
	defer producer.Close()

	// --- Initialize Delivery Engine ---
	engine := delivery.NewEngine(repo, retryStore)

	// --- Context for graceful shutdown ---
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// --- Start Kafka Consumer ---
	consumer := kafkapkg.NewConsumer(func(ctx context.Context, msg kafkapkg.EventMessage) error {
		eventID, err := uuid.Parse(msg.EventID)
		if err != nil {
			log.Printf("Invalid event ID: %s", msg.EventID)
			return nil // Skip bad messages
		}
		return engine.DeliverEvent(ctx, eventID, msg.EventType, msg.Payload)
	})
	defer consumer.Close()
	go consumer.Start(ctx)

	// --- Start Retry Scheduler ---
	scheduler := delivery.NewScheduler(repo, retryStore, engine)
	go scheduler.Start(ctx)

	// --- Start HTTP Server ---
	router := api.SetupRouter(repo, producer, engine)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf(" API server listening on :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// --- Graceful Shutdown ---
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println(" Shutting down...")

	cancel() // Stop consumer and scheduler

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println(" Server stopped gracefully")
}