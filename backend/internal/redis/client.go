package redis

import (
	"context"
	"log"
	"os"
	"time"

	goredis "github.com/redis/go-redis/v9"
)

// NewRedisClient creates a new Redis client
func NewRedisClient() *goredis.Client {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379"
	}

	client := goredis.NewClient(&goredis.Options{
		Addr:         addr,
		DB:           0,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     20,
	})

	// Verify connection
	for i := 0; i < 30; i++ {
		err := client.Ping(context.Background()).Err()
		if err == nil {
			break
		}
		log.Printf("Waiting for Redis... attempt %d/30", i+1)
		time.Sleep(time.Second)
	}

	log.Println(" Connected to Redis")
	return client
}