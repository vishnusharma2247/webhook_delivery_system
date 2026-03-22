package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

// NewPostgresDB creates a new Postgres connection pool
func NewPostgresDB() (*sql.DB, error) {
	host := getEnv("POSTGRES_HOST", "localhost")
	port := getEnv("POSTGRES_PORT", "5432")
	user := getEnv("POSTGRES_USER", "webhook")
	password := getEnv("POSTGRES_PASSWORD", "webhook_secret")
	dbname := getEnv("POSTGRES_DB", "webhook_delivery")

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname,
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Verify connection
	for i := 0; i < 30; i++ {
		err = db.Ping()
		if err == nil {
			break
		}
		log.Printf("Waiting for postgres... attempt %d/30", i+1)
		time.Sleep(time.Second)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database after 30 attempts: %w", err)
	}

	log.Println(" Connected to Postgres")
	return db, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}