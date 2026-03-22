package kafka

import (
	"context"
	"encoding/json"
	"log"
	"os"

	kafkago "github.com/segmentio/kafka-go"
)

const (
	TopicWebhookEvents = "webhook-events"
)

// EventMessage is the Kafka message payload
type EventMessage struct {
	EventID        string `json:"event_id"`
	EventType      string `json:"event_type"`
	Payload        string `json:"payload"`
	SubscriptionID string `json:"subscription_id"`
}

// Producer wraps a Kafka writer
type Producer struct {
	writer *kafkago.Writer
}

// NewProducer creates a new Kafka producer
func NewProducer() *Producer {
	broker := getEnv("KAFKA_BROKER", "localhost:29092")

	writer := &kafkago.Writer{
		Addr:     kafkago.TCP(broker),
		Topic:    TopicWebhookEvents,
		Balancer: &kafkago.Hash{}, // Partition by key for ordering
	}

	log.Println(" Kafka producer initialized")
	return &Producer{writer: writer}
}

// Publish sends an event message to Kafka, partitioned by subscription ID
func (p *Producer) Publish(ctx context.Context, msg EventMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return p.writer.WriteMessages(ctx, kafkago.Message{
		Key:   []byte(msg.SubscriptionID), // Partition key for ordering
		Value: data,
	})
}

// Close shuts down the producer
func (p *Producer) Close() error {
	return p.writer.Close()
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}