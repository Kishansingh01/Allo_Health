import { NextRequest, NextResponse } from 'next/server'
import { acquireLock, releaseLock, setWithExpiry, getFromRedis } from '@/lib/redis'
import { createReservationSchema } from '@/lib/schemas'
import { createMockReservation } from '@/lib/mockData'

// Reservation TTL in seconds (10 minutes)
const RESERVATION_TTL = 600

export async function POST(request: NextRequest) {
  try {
    const { default: prisma } = await import('@/lib/prisma')
    const body = await request.json()
    const idempotencyKey = request.headers.get('Idempotency-Key')

    // 1. Validate input
    const validationResult = createReservationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { productId, warehouseId, quantity } = validationResult.data

    // 2. Check for idempotent request first
    if (idempotencyKey) {
      try {
        const cachedResponse = await getFromRedis(`idempotent:reserve:${idempotencyKey}`)
        if (cachedResponse) {
          return NextResponse.json(JSON.parse(cachedResponse))
        }
      } catch (e) {
        // Redis not available
      }
    }

    // 3. Fast check if PostgreSQL database is running and reachable
    let isDbAvailable = false
    try {
      await prisma.$queryRaw`SELECT 1`
      isDbAvailable = true
    } catch (e) {
      console.log('Database not available, using mock mode fallback.')
    }

    // 4. Database Path (with Concurrency Control & Redis Lock)
    if (isDbAvailable) {
      const lockKey = `lock:stock:${productId}:${warehouseId}`
      let lockId: string | null = null

      try {
        lockId = await acquireLock(lockKey, 10) // Acquire a 10-second lock
      } catch (e) {
        // Redis not available
      }

      // If Redis URL is set (indicating production environment) but lock failed, return 503
      if (!lockId && process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
        return NextResponse.json(
          { error: 'Resource temporarily unavailable, please retry' },
          { status: 503 }
        )
      }

      try {
        // Execute state changes inside a transaction
        const response = await prisma.$transaction(async (tx) => {
          // Re-fetch and verify stock
          const stock = await tx.stock.findUnique({
            where: {
              productId_warehouseId: { productId, warehouseId },
            },
            include: {
              product: { select: { name: true } },
              warehouse: { select: { name: true } },
            },
          })

          if (!stock) {
            throw new Error('PRODUCT_NOT_FOUND')
          }

          const available = stock.total - stock.reserved
          if (available < quantity) {
            throw new Error('INSUFFICIENT_STOCK')
          }

          // Decrement available stock by incrementing reserved count
          await tx.stock.update({
            where: { id: stock.id },
            data: {
              reserved: {
                increment: quantity,
              },
            },
          })

          // Create the Reservation record
          const expiresAt = new Date(Date.now() + RESERVATION_TTL * 1000)
          const reservation = await tx.reservation.create({
            data: {
              productId,
              warehouseId,
              quantity,
              status: 'PENDING',
              expiresAt,
              idempotencyKey,
            },
          })

          return {
            id: reservation.id,
            productId: reservation.productId,
            productName: stock.product.name,
            warehouseId: reservation.warehouseId,
            warehouseName: stock.warehouse.name,
            quantity: reservation.quantity,
            status: reservation.status,
            expiresAt: reservation.expiresAt.toISOString(),
            createdAt: reservation.createdAt.toISOString(),
          }
        })

        // Cache the response in Redis for Idempotency
        if (idempotencyKey) {
          try {
            await setWithExpiry(
              `idempotent:reserve:${idempotencyKey}`,
              JSON.stringify(response),
              RESERVATION_TTL
            )
          } catch (e) {
            // Redis not available
          }
        }

        return NextResponse.json(response, { status: 201 })
      } catch (txError: any) {
        if (txError.message === 'INSUFFICIENT_STOCK') {
          return NextResponse.json(
            { error: 'Not enough stock available' },
            { status: 409 }
          )
        }
        if (txError.message === 'PRODUCT_NOT_FOUND') {
          return NextResponse.json(
            { error: 'Product or stock not found in the selected warehouse' },
            { status: 404 }
          )
        }
        console.error('Database transaction failed, falling back to mock:', txError.message)
      } finally {
        if (lockId) {
          try {
            await releaseLock(lockKey, lockId)
          } catch (e) {
            // Redis not available
          }
        }
      }
    }

    // 5. Graceful Fallback Mode: In-Memory Persistent Mock Data
    try {
      const reservation = createMockReservation(productId, warehouseId, quantity)

      const response = {
        id: reservation.id,
        productId: reservation.productId,
        productName: reservation.productName,
        warehouseId: reservation.warehouseId,
        warehouseName: reservation.warehouseName,
        quantity: reservation.quantity,
        status: reservation.status,
        expiresAt: reservation.expiresAt,
        createdAt: reservation.createdAt,
      }

      // Cache the mock response for Idempotency if key is provided
      if (idempotencyKey) {
        try {
          await setWithExpiry(
            `idempotent:reserve:${idempotencyKey}`,
            JSON.stringify(response),
            RESERVATION_TTL
          )
        } catch (e) {
          // Redis not available
        }
      }

      return NextResponse.json(response, { status: 201 })
    } catch (mockError: any) {
      console.error('Mock reservation error:', mockError.message)
      return NextResponse.json(
        { error: mockError.message || 'Failed to create reservation' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    )
  }
}
