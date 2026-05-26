# Allo Inventory Reservation System

A Next.js full-stack application for managing multi-warehouse inventory with real-time reservation system. Handles concurrent reservation requests safely to prevent overselling.

## Overview

This system solves the inventory race condition problem by implementing a **reservation** pattern:
- When a customer proceeds to checkout, units are **reserved** temporarily (10 minutes)
- If payment succeeds, the reservation is **confirmed** and stock is permanently decremented
- If payment fails or time expires, the reservation is **released** and units become available again

This prevents both overselling (two customers getting the same item) and false stock depletion (carts hold inventory unnecessarily).

## Architecture

### Core Components

1. **Database Schema (Prisma + Postgres)**
   - `Product`: Product catalog
   - `Warehouse`: Physical warehouse locations
   - `Stock`: Inventory levels per product/warehouse with `total` and `reserved` fields
   - `Reservation`: Temporary holds with expiry times and status tracking

2. **API Endpoints**
   - `GET /api/products` - List products with available stock per warehouse
   - `GET /api/warehouses` - List all warehouses
   - `POST /api/reservations` - Create a reservation (handles concurrency)
   - `POST /api/reservations/:id/confirm` - Confirm reservation (payment succeeded)
   - `POST /api/reservations/:id/release` - Release/cancel reservation
   - `GET /api/reservations/:id` - Fetch reservation details

3. **Frontend**
   - Product listing page with "Reserve" buttons
   - Checkout page with live countdown timer
   - Real-time status updates (no page refresh required)

4. **Background Jobs**
   - Expiry cleanup: Vercel Crons job that runs periodically to release expired reservations

## Concurrency & Race Condition Prevention

### The Problem
If two requests arrive simultaneously for the last unit of a product:
- Both check stock: 1 available ✓
- Both try to reserve: Both succeed ✗ (overselling)

### The Solution: Distributed Locking with Redis

```typescript
// Acquire lock per product/warehouse
const lockKey = `lock:stock:${productId}:${warehouseId}`
const lockId = await acquireLock(lockKey, 10) // 10-second lock

// Only one request succeeds; others get 503 and should retry
if (!lockId) {
  return 503 // Retry after brief backoff
}

// Within lock: check stock, validate, create reservation, update stock
// All in a Prisma transaction for consistency
```

**Why this works:**
1. **Lock serializes access** - Only one request can hold the lock at a time
2. **Atomic transaction** - Stock check and update happen together
3. **Lua script for release** - Prevents accidental release of another process's lock
4. **Lock timeout** - Prevents deadlocks if a process crashes

### Idempotency (Bonus)

The API supports idempotent requests using `Idempotency-Key` header:
- If client retries with the same key, server returns cached response
- Prevents duplicate reservations if network fails mid-request
- Cache TTL matches reservation TTL (10 minutes)

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL (or managed: Supabase, Neon, Railway)
- Redis (or managed: Upstash, Redis Cloud)

### 1. Setup

```bash
# Clone and install
git clone <your-repo>
cd allo-inventory-reservation
npm install

# Create environment file
cp .env.example .env.local
```

### 2. Configure Environment Variables

```bash
# .env.local

# PostgreSQL (replace with your DB URL)
DATABASE_URL="postgresql://user:password@localhost:5432/allo"

# Redis (replace with your Redis URL)
REDIS_URL="redis://localhost:6379"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Optional: Cron secret for cleanup job
CRON_SECRET="your-secret-key-here"
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database with test data
npm run seed
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Stack
- **Frontend/API**: Vercel (Next.js deployment)
- **Database**: Supabase, Neon, or Railway (PostgreSQL)
- **Cache**: Upstash (Redis)
- **Crons**: Vercel Crons (for expiry cleanup)

### Vercel Deployment

```bash
# Connect to GitHub and deploy
vercel

# Set environment variables in Vercel dashboard
REDIS_URL
DATABASE_URL
CRON_SECRET
```

### Vercel Crons Configuration

Create `vercel.json` in root:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-reservations",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs the cleanup job every hour, checking for expired reservations and releasing them.

## Reservation Expiry Mechanism

### Production Approach: Vercel Crons

The recommended production approach uses **Vercel Crons**:

1. **Periodic cleanup**: Every hour, the cron job hits `/api/cron/cleanup-reservations`
2. **Finds expired**: Queries for `PENDING` reservations where `expiresAt < now()`
3. **Releases**: Updates stock to decrement `reserved`, marks reservation as `RELEASED`
4. **Secured**: Validates `CRON_SECRET` header

**Pros:**
- Simple, reliable, no extra infrastructure
- Vercel handles scheduling and retries
- Works with free tier

**Cons:**
- 1-hour granularity; expired items stay reserved for up to 1 hour
- Improves with more frequent cron runs (e.g., every 5 minutes)

### Alternative Approaches

1. **Background Worker** (Bull queue, Inngest)
   - Real-time cleanup as reservations expire
   - More complex; requires separate worker process
   - Better UX (units available immediately)

2. **Lazy Cleanup on Read**
   - Check expiry when fetching stock levels
   - Simplest; no infrastructure
   - Can leave expired reservations stale until accessed

## Trade-offs and Design Decisions

### 1. Reservation TTL = 10 Minutes
- **Why**: Long enough for most payment flows (3DS, UPI, redirects)
- **Trade-off**: Inventory held longer, potentially lower conversion
- **Alternative**: Make configurable per product type

### 2. Pessimistic Locking (Redis Lock)
- **Why**: Simple, bulletproof concurrency
- **Trade-off**: Lock contention under high load
- **Alternative**: Optimistic locking (version columns), but requires client retry logic

### 3. Cron-based Cleanup (1-hour frequency)
- **Why**: Simple, free tier compatible
- **Trade-off**: Expired reservations stay reserved for up to 1 hour
- **Improvement**: Could run every 5 minutes for better UX

### 4. Idempotency via Redis Cache
- **Why**: Simple, works with lock-based design
- **Trade-off**: Cache key collisions (mitigation: hash of request body)
- **Production note**: Would add `request_id` to database for permanent audit trail

### 5. No Inventory Holds at Add-to-Cart
- **Why**: Prevents false stock depletion
- **Trade-off**: Checkout can fail if stock depleted while customer reviews cart
- **UX Mitigation**: Real-time stock updates, clear "held until" timers

## Database Schema Notes

```sql
-- Stock levels
total    : Total units in warehouse (immutable after initial receipt)
reserved : Units held by active PENDING reservations
available = total - reserved  (What customers see)

-- Reservation statuses
PENDING   -> CONFIRMED : Payment succeeded
PENDING   -> RELEASED  : Payment failed, time expired, or user cancelled
```

### Indexes for Performance
```sql
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_expires_at ON reservations(expiresAt);
CREATE INDEX idx_reservations_idempotency_key ON reservations(idempotencyKey);
```

## Testing Concurrency

### Local Stress Test

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run concurrent requests
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/reservations \
    -H "Content-Type: application/json" \
    -d '{
      "productId": "PRODUCT_ID",
      "warehouseId": "WAREHOUSE_ID",
      "quantity": 1
    }' &
done
wait
```

Expected: 1 success (201), rest get 503 (lock timeout) or 409 (no stock).

## Monitoring & Observability

### Key Metrics
- Lock acquisition time
- Reservation confirmation rate
- Expiry cleanup effectiveness (count of released reservations)
- Cache hit rate (idempotency)

### Logs
- All errors logged with context
- Redis lock failures trigger alerts
- Cron job success/failure logged

## Future Improvements

1. **Metrics Dashboard**: Real-time reservation and inventory graphs
2. **Configurable TTLs**: Per-product reservation windows
3. **Inventory Forecasting**: Predict stockouts based on reservation velocity
4. **Multi-region Warehouses**: Calculate shipment distance, lead times
5. **Payment Integration**: Automatic confirm/release based on payment webhooks
6. **Analytics**: Abandoned reservations, most-reserved products
7. **A/B Testing**: TTL duration impact on conversion

## Known Limitations

1. **No inventory adjustments mid-reservation**: If warehouse receives new stock, reserved count doesn't adjust
2. **No partial fulfillment**: Reservation is all-or-nothing
3. **No waitlist**: Customers can't queue if stock runs out
4. **SQLite limitation**: This uses Postgres; SQLite won't support row-level locking needed for scale
5. **Redis single-point-of-failure**: Cluster setup recommended for prod

## Stack Versions

- Node.js 18+
- Next.js 15
- React 19
- TypeScript 5.3
- Prisma 5.7
- Redis 4.6
- Tailwind CSS 3.4
- Zod 3.22

## License

MIT
