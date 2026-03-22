.PHONY: dev dev-down backend frontend migrate test build clean

# Start infrastructure (Kafka, Postgres, Redis)
dev:
	docker-compose up -d

# Stop infrastructure
dev-down:
	docker-compose down

# Run backend server
backend:
	cd backend && POSTGRES_PORT=5433 go run cmd/server/main.go

# Run frontend dev server
frontend:
	cd frontend && npm run dev

# Run database migrations (handled by backend on startup)
migrate:
	cd backend && POSTGRES_PORT=5433 go run cmd/server/main.go --migrate-only

# Run backend tests
test:
	cd backend && go test ./...

# Build backend binary
build:
	cd backend && go build -o ../bin/webhook-server cmd/server/main.go

# Clean build artifacts
clean:
	rm -rf bin/
