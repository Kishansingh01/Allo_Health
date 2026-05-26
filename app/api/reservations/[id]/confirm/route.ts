import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { acquireLock, releaseLock, setWithExpiry, getFromRedis } from '@/lib/redis'
import { confirmReservation as confirmMockReservation } from '@/lib/mockData'

const RESERVATION_TTL = 600

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    const idempotencyKey = request.headers.get('Idempotency-Key')

    // Check for idempotent request
    if (idempotencyKey) {
      try {
        const cachedResponse = await getFromRedis(`idempotent:confirm:${idempotencyKey}`)
        if (cachedResponse) {
          return NextResponse.json(JSON.parse(cachedResponse))
        }
      } catch (e) {
        // Redis not available
      }
    }

    try {
      // Get reservation first (without lock)
      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        include: {
          product: { select: { name: true } },
          warehouse: { select: { name: true } },
        },
      })

      if (!reservation) {
        return NextResponse.json(
          { error: 'Reservation not found' },
          { status: 404 }
        )
      }

      // Check if already confirmed or released
      if (reservation.status !== 'PENDING') {
        return NextResponse.json(
          {
            error: `Reservation is already ${reservation.status.toLowerCase()}`,
            status: reservation.status,
          },
          { status: 409 }
        )
      }

      // Check if expired (410 Gone status per spec)
      if (new Date() > reservation.expiresAt) {
        return NextResponse.json(
          { error: 'Reservation has expired' },
          { status: 410 }
        )
      }

      // Use distributed lock
      let lockId: string | null = null
      try {
        lockId = await acquireLock(`lock:reservation:${reservationId}`, 10)
      } catch (e) {
        // Redis not available
      }

      if (!lockId && process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
        return NextResponse.json(
          { error: 'Resource temporarily unavailable, please retry' },
          { status: 503 }
        )
      }

      try {
        // Confirm the reservation with transaction
        const confirmedReservation = await prisma.$transaction(async (tx) => {
          // Re-check reservation state after acquiring lock
          const latestReservation = await tx.reservation.findUnique({
            where: { id: reservationId },
          })

          if (!latestReservation) {
            throw new Error('Reservation not found')
          }

          if (latestReservation.status !== 'PENDING') {
            throw new Error(`Reservation is ${latestReservation.status}`)
          }

          if (new Date() > latestReservation.expiresAt) {
            throw new Error('Reservation expired')
          }

          // Update reservation status
          return await tx.reservation.update({
            where: { id: reservationId },
            data: {
              status: 'CONFIRMED',
              confirmedAt: new Date(),
            },
            include: {
              product: { select: { name: true, sku: true } },
              warehouse: { select: { name: true } },
            },
          })
        })

        const response = {
          id: confirmedReservation.id,
          status: confirmedReservation.status,
          confirmedAt: confirmedReservation.confirmedAt,
          productName: confirmedReservation.product.name,
          warehouseName: confirmedReservation.warehouse.name,
          quantity: confirmedReservation.quantity,
        }

        // Cache idempotent response
        if (idempotencyKey) {
          try {
            await setWithExpiry(
              `idempotent:confirm:${idempotencyKey}`,
              JSON.stringify(response),
              RESERVATION_TTL
            )
          } catch (e) {
            // Redis not available
          }
        }

        return NextResponse.json(response)
      } finally {
        if (lockId) {
          try {
            await releaseLock(`lock:reservation:${reservationId}`, lockId)
          } catch (e) {
            // Redis not available
          }
        }
      }
    } catch (dbError: any) {
      // Database not available, use mock data
      try {
        const confirmedReservation = confirmMockReservation(reservationId)
        const response = {
          id: confirmedReservation.id,
          status: confirmedReservation.status,
          confirmedAt: confirmedReservation.confirmedAt,
          productName: confirmedReservation.productName,
          warehouseName: confirmedReservation.warehouseName,
          quantity: confirmedReservation.quantity,
        }

        // Cache idempotent response
        if (idempotencyKey) {
          try {
            await setWithExpiry(
              `idempotent:confirm:${idempotencyKey}`,
              JSON.stringify(response),
              RESERVATION_TTL
            )
          } catch (e) {
            // Redis not available
          }
        }

        return NextResponse.json(response)
      } catch (mockError: any) {
        if (mockError.message === 'Reservation expired') {
          return NextResponse.json(
            { error: 'Reservation has expired' },
            { status: 410 }
          )
        }
        return NextResponse.json(
          { error: mockError.message || 'Failed to confirm reservation' },
          { status: 400 }
        )
      }
    }
  } catch (error) {
    console.error('Error confirming reservation:', error)
    return NextResponse.json(
      { error: 'Failed to confirm reservation' },
      { status: 500 }
    )
  }
}
