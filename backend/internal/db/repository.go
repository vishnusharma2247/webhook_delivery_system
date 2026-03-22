package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// Repository provides data access methods for the webhook delivery system
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new Repository
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// ---- Subscriptions ----

// CreateSubscription inserts a new subscription
func (r *Repository) CreateSubscription(sub *Subscription) error {
	sub.ID = uuid.New()
	sub.Status = SubStatusActive
	sub.CreatedAt = time.Now().UTC()
	sub.UpdatedAt = sub.CreatedAt

	if sub.Secret == "" {
		sub.Secret = uuid.New().String()
	}

	_, err := r.db.Exec(
		`INSERT INTO subscriptions (id, url, secret, event_types, status, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		sub.ID, sub.URL, sub.Secret, pq.Array(sub.EventTypes),
		sub.Status, sub.CreatedAt, sub.UpdatedAt,
	)
	return err
}

// GetSubscription retrieves a subscription by ID
func (r *Repository) GetSubscription(id uuid.UUID) (*Subscription, error) {
	sub := &Subscription{}
	err := r.db.QueryRow(
		`SELECT id, url, secret, event_types, status, created_at, updated_at
		 FROM subscriptions WHERE id = $1`, id,
	).Scan(&sub.ID, &sub.URL, &sub.Secret, pq.Array(&sub.EventTypes),
		&sub.Status, &sub.CreatedAt, &sub.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return sub, nil
}

// ListSubscriptions returns all subscriptions
func (r *Repository) ListSubscriptions() ([]Subscription, error) {
	rows, err := r.db.Query(
		`SELECT id, url, secret, event_types, status, created_at, updated_at
		 FROM subscriptions ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var sub Subscription
		if err := rows.Scan(&sub.ID, &sub.URL, &sub.Secret, pq.Array(&sub.EventTypes),
			&sub.Status, &sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, nil
}

// UpdateSubscription updates a subscription
func (r *Repository) UpdateSubscription(sub *Subscription) error {
	sub.UpdatedAt = time.Now().UTC()
	_, err := r.db.Exec(
		`UPDATE subscriptions SET url=$1, secret=$2, event_types=$3, status=$4, updated_at=$5
		 WHERE id=$6`,
		sub.URL, sub.Secret, pq.Array(sub.EventTypes), sub.Status, sub.UpdatedAt, sub.ID,
	)
	return err
}

// DeleteSubscription removes a subscription
func (r *Repository) DeleteSubscription(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM subscriptions WHERE id = $1`, id)
	return err
}

// GetActiveSubscriptionsForEventType returns active subscriptions matching an event type
func (r *Repository) GetActiveSubscriptionsForEventType(eventType string) ([]Subscription, error) {
	rows, err := r.db.Query(
		`SELECT id, url, secret, event_types, status, created_at, updated_at
		 FROM subscriptions
		 WHERE status = 'active' AND ($1 = ANY(event_types) OR array_length(event_types, 1) IS NULL OR event_types = '{}')`,
		eventType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []Subscription
	for rows.Next() {
		var sub Subscription
		if err := rows.Scan(&sub.ID, &sub.URL, &sub.Secret, pq.Array(&sub.EventTypes),
			&sub.Status, &sub.CreatedAt, &sub.UpdatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, nil
}

// ---- Deliveries ----

// CreateDelivery inserts a new delivery record
func (r *Repository) CreateDelivery(d *Delivery) error {
	_, err := r.db.Exec(
		`INSERT INTO deliveries (id, subscription_id, event_id, event_type, payload, status, attempts, max_retries, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		d.ID, d.SubscriptionID, d.EventID, d.EventType, d.Payload,
		d.Status, d.Attempts, d.MaxRetries, d.CreatedAt,
	)
	return err
}

// UpdateDeliveryStatus updates the status and attempt info for a delivery
func (r *Repository) UpdateDeliveryStatus(d *Delivery) error {
	_, err := r.db.Exec(
		`UPDATE deliveries
		 SET status=$1, attempts=$2, last_attempt_at=$3, next_retry_at=$4, response_code=$5, response_body=$6
		 WHERE id=$7`,
		d.Status, d.Attempts, d.LastAttemptAt, d.NextRetryAt, d.ResponseCode, d.ResponseBody, d.ID,
	)
	return err
}

// GetDelivery retrieves a delivery by ID
func (r *Repository) GetDelivery(id uuid.UUID) (*Delivery, error) {
	d := &Delivery{}
	err := r.db.QueryRow(
		`SELECT id, subscription_id, event_id, event_type, payload, status, attempts, max_retries,
		        last_attempt_at, next_retry_at, response_code, response_body, created_at
		 FROM deliveries WHERE id = $1`, id,
	).Scan(&d.ID, &d.SubscriptionID, &d.EventID, &d.EventType, &d.Payload,
		&d.Status, &d.Attempts, &d.MaxRetries, &d.LastAttemptAt, &d.NextRetryAt,
		&d.ResponseCode, &d.ResponseBody, &d.CreatedAt)
	if err != nil {
		return nil, err
	}
	return d, nil
}

// ListDeliveries returns deliveries with optional filtering
func (r *Repository) ListDeliveries(status string, subscriptionID string, limit, offset int) ([]Delivery, int64, error) {
	var conditions []string
	var args []interface{}
	argIdx := 1

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}
	if subscriptionID != "" {
		conditions = append(conditions, fmt.Sprintf("subscription_id = $%d", argIdx))
		args = append(args, subscriptionID)
		argIdx++
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM deliveries %s", where)
	err := r.db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := fmt.Sprintf(
		`SELECT id, subscription_id, event_id, event_type, payload, status, attempts, max_retries,
		        last_attempt_at, next_retry_at, response_code, response_body, created_at
		 FROM deliveries %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		where, argIdx, argIdx+1,
	)
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var deliveries []Delivery
	for rows.Next() {
		var d Delivery
		if err := rows.Scan(&d.ID, &d.SubscriptionID, &d.EventID, &d.EventType, &d.Payload,
			&d.Status, &d.Attempts, &d.MaxRetries, &d.LastAttemptAt, &d.NextRetryAt,
			&d.ResponseCode, &d.ResponseBody, &d.CreatedAt); err != nil {
			return nil, 0, err
		}
		deliveries = append(deliveries, d)
	}
	return deliveries, total, nil
}

// GetDeliveriesBySubscription returns deliveries for a specific subscription
func (r *Repository) GetDeliveriesBySubscription(subID uuid.UUID, limit, offset int) ([]Delivery, int64, error) {
	return r.ListDeliveries("", subID.String(), limit, offset)
}

// ---- Dead Letter Queue ----

// MoveToDLQ moves a failed delivery to the dead letter queue
func (r *Repository) MoveToDLQ(d *Delivery, failureReason string, url string) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Insert into DLQ
	_, err = tx.Exec(
		`INSERT INTO dead_letter_queue (id, delivery_id, subscription_id, event_id, event_type, payload, failure_reason, url, attempts, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		uuid.New(), d.ID, d.SubscriptionID, d.EventID, d.EventType, d.Payload,
		failureReason, url, d.Attempts, time.Now().UTC(),
	)
	if err != nil {
		return err
	}

	// Update delivery status to dlq
	_, err = tx.Exec(
		`UPDATE deliveries SET status = 'dlq' WHERE id = $1`, d.ID,
	)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// ListDLQ returns dead letter queue entries
func (r *Repository) ListDLQ(limit, offset int) ([]DeadLetterEntry, int64, error) {
	var total int64
	err := r.db.QueryRow("SELECT COUNT(*) FROM dead_letter_queue").Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := r.db.Query(
		`SELECT id, delivery_id, subscription_id, event_id, event_type, payload, failure_reason, url, attempts, created_at
		 FROM dead_letter_queue ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var entries []DeadLetterEntry
	for rows.Next() {
		var e DeadLetterEntry
		if err := rows.Scan(&e.ID, &e.DeliveryID, &e.SubscriptionID, &e.EventID,
			&e.EventType, &e.Payload, &e.FailureReason, &e.URL, &e.Attempts, &e.CreatedAt); err != nil {
			return nil, 0, err
		}
		entries = append(entries, e)
	}
	return entries, total, nil
}

// GetDLQEntry retrieves a single DLQ entry
func (r *Repository) GetDLQEntry(id uuid.UUID) (*DeadLetterEntry, error) {
	e := &DeadLetterEntry{}
	err := r.db.QueryRow(
		`SELECT id, delivery_id, subscription_id, event_id, event_type, payload, failure_reason, url, attempts, created_at
		 FROM dead_letter_queue WHERE id = $1`, id,
	).Scan(&e.ID, &e.DeliveryID, &e.SubscriptionID, &e.EventID,
		&e.EventType, &e.Payload, &e.FailureReason, &e.URL, &e.Attempts, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return e, nil
}

// RetryFromDLQ removes a DLQ entry and creates a new delivery for retry
func (r *Repository) RetryFromDLQ(dlqID uuid.UUID) (*Delivery, error) {
	entry, err := r.GetDLQEntry(dlqID)
	if err != nil {
		return nil, err
	}

	tx, err := r.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Delete from DLQ
	_, err = tx.Exec(`DELETE FROM dead_letter_queue WHERE id = $1`, dlqID)
	if err != nil {
		return nil, err
	}

	// Create new delivery
	newDelivery := &Delivery{
		ID:             uuid.New(),
		SubscriptionID: entry.SubscriptionID,
		EventID:        entry.EventID,
		EventType:      entry.EventType,
		Payload:        entry.Payload,
		Status:         StatusPending,
		Attempts:       0,
		MaxRetries:     5,
		CreatedAt:      time.Now().UTC(),
	}

	_, err = tx.Exec(
		`INSERT INTO deliveries (id, subscription_id, event_id, event_type, payload, status, attempts, max_retries, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		newDelivery.ID, newDelivery.SubscriptionID, newDelivery.EventID,
		newDelivery.EventType, newDelivery.Payload, newDelivery.Status,
		newDelivery.Attempts, newDelivery.MaxRetries, newDelivery.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(); err != nil {
		return nil, err
	}

	return newDelivery, nil
}

// PurgeDLQ deletes a DLQ entry
func (r *Repository) PurgeDLQ(id uuid.UUID) error {
	_, err := r.db.Exec(`DELETE FROM dead_letter_queue WHERE id = $1`, id)
	return err
}

// ---- Stats ----

// GetDashboardStats returns aggregate statistics
func (r *Repository) GetDashboardStats() (*DashboardStats, error) {
	stats := &DashboardStats{}

	err := r.db.QueryRow(`SELECT COUNT(*) FROM deliveries`).Scan(&stats.TotalDeliveries)
	if err != nil {
		return nil, err
	}

	r.db.QueryRow(`SELECT COUNT(*) FROM deliveries WHERE status = 'delivered'`).Scan(&stats.SuccessfulCount)
	r.db.QueryRow(`SELECT COUNT(*) FROM deliveries WHERE status = 'failed'`).Scan(&stats.FailedCount)
	r.db.QueryRow(`SELECT COUNT(*) FROM deliveries WHERE status = 'pending'`).Scan(&stats.PendingCount)
	r.db.QueryRow(`SELECT COUNT(*) FROM dead_letter_queue`).Scan(&stats.DLQCount)
	r.db.QueryRow(`SELECT COUNT(*) FROM subscriptions WHERE status = 'active'`).Scan(&stats.ActiveSubscriptions)

	if stats.TotalDeliveries > 0 {
		stats.SuccessRate = float64(stats.SuccessfulCount) / float64(stats.TotalDeliveries) * 100
	}

	return stats, nil
}