package kafka

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"time"

	kafkago "github.com/segmentio/kafka-go"
)

// MessageHandler is called for each consumed message
type MessageHandler func(ctx context.Context, msg EventMessage) error

// Consumer wraps a Kafka reader
type Consumer struct {
	reader  *kafkago.Reader
	handler MessageHandler
}

// NewConsumer creates a new Kafka consumer
func NewConsumer(handler MessageHandler) *Consumer {
	broker := os.Getenv("KAFKA_BROKER")
	if broker == "" {
		broker = "localhost:29092"
	}

	reader := kafkago.NewReader(kafkago.ReaderConfig{
		Brokers:        []string{broker},
		Topic:          TopicWebhookEvents,
		GroupID:        "webhook-delivery-group",
		MinBytes:       1,
		MaxBytes:       10e6,
		CommitInterval: 0, // Manual commit for at-least-once
		StartOffset:    kafkago.FirstOffset,
		MaxWait:        time.Second,
	})

	log.Println(" Kafka consumer initialized")
	return &Consumer{reader: reader, handler: handler}
}

// Start begins consuming messages in a loop
func (c *Consumer) Start(ctx context.Context) {
	log.Println(" Kafka consumer started, waiting for messages...")
	for {
		select {
		case <-ctx.Done():
			log.Println("Kafka consumer shutting down...")
			return
		default:
			msg, err := c.reader.FetchMessage(ctx)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				log.Printf("Error fetching message: %v", err)
				time.Sleep(time.Second)
				continue
			}

			var eventMsg EventMessage
			if err := json.Unmarshal(msg.Value, &eventMsg); err != nil {
				log.Printf("Error unmarshaling message: %v", err)
				// Commit bad messages to avoid blocking
				c.reader.CommitMessages(ctx, msg)
				continue
			}

			// Process message — only commit after handler succeeds (at-least-once)
			if err := c.handler(ctx, eventMsg); err != nil {
				log.Printf("Error handling message: %v (will retry)", err)
				// Don't commit — message will be redelivered
				time.Sleep(time.Second)
				continue
			}

			// Commit offset after successful processing
			if err := c.reader.CommitMessages(ctx, msg); err != nil {
				log.Printf("Error committing message: %v", err)
			}
		}
	}
}

// Close shuts down the consumer
func (c *Consumer) Close() error {
	return c.reader.Close()
}