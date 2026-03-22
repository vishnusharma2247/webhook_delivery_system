package db

import (
	"database/sql"
	"log"
)

// RunMigrations creates all required tables
func RunMigrations(db *sql.DB) error {
	migrations := []string{
		`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

		`CREATE TABLE IF NOT EXISTS subscriptions (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			url TEXT NOT NULL,
			secret TEXT NOT NULL DEFAULT '',
			event_types TEXT[] NOT NULL DEFAULT '{}',
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)`,

		`CREATE TABLE IF NOT EXISTS deliveries (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
			event_id UUID NOT NULL,
			event_type VARCHAR(255) NOT NULL DEFAULT '',
			payload JSONB NOT NULL DEFAULT '{}',
			status VARCHAR(20) NOT NULL DEFAULT 'pending',
			attempts INT NOT NULL DEFAULT 0,
			max_retries INT NOT NULL DEFAULT 5,
			last_attempt_at TIMESTAMP WITH TIME ZONE,
			next_retry_at TIMESTAMP WITH TIME ZONE,
			response_code INT,
			response_body TEXT,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)`,

		`CREATE INDEX IF NOT EXISTS idx_deliveries_subscription_id ON deliveries(subscription_id)`,
		`CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)`,
		`CREATE INDEX IF NOT EXISTS idx_deliveries_next_retry_at ON deliveries(next_retry_at) WHERE status = 'failed'`,
		`CREATE INDEX IF NOT EXISTS idx_deliveries_event_id ON deliveries(event_id)`,

		`CREATE TABLE IF NOT EXISTS dead_letter_queue (
			id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
			delivery_id UUID NOT NULL,
			subscription_id UUID NOT NULL,
			event_id UUID NOT NULL,
			event_type VARCHAR(255) NOT NULL DEFAULT '',
			payload JSONB NOT NULL DEFAULT '{}',
			failure_reason TEXT NOT NULL DEFAULT '',
			url TEXT NOT NULL DEFAULT '',
			attempts INT NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
		)`,

		`CREATE INDEX IF NOT EXISTS idx_dlq_subscription_id ON dead_letter_queue(subscription_id)`,
	}

	for _, m := range migrations {
		if _, err := db.Exec(m); err != nil {
			return err
		}
	}

	log.Println(" Database migrations completed")
	return nil
}