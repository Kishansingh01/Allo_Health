import { NextRequest, NextResponse } from 'next/server'
// Prisma is imported lazily inside the handler to avoid build-time DB access
import { acquireLock, releaseLock } from '@/lib/redis'
import { releaseReservation as releaseMockReservation } from '@/lib/mockData'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { default: prisma } = await import('@/lib/prisma')
    const { id: reservationId } = await params

    try {
      // Get reservation first
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

      if (reservation.status !== 'PENDING') {
        return NextResponse.json(
          {
            error: `Cannot release ${reservation.status.toLowerCase()} reservation`,
            status: reservation.status,
          },
          { status: 409 }
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
        // Release the reservation with transaction
        const releasedReservation = await prisma.$transaction(async (tx) => {
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

          // Update stock to release reserved units
          await tx.stock.update({
            where: {
              productId_warehouseId: {
                productId: latestReservation.productId,
                warehouseId: latestReservation.warehouseId,
              },
            },
            data: {
              reserved: {
                decrement: latestReservation.quantity,
              },
            },
          })

          // Update reservation status
          return await tx.reservation.update({
            where: { id: reservationId },
            data: {
              status: 'RELEASED',
              releasedAt: new Date(),
            },
            include: {
              product: { select: { name: true } },
              warehouse: { select: { name: true } },
            },
          })
        })

        return NextResponse.json({
          id: releasedReservation.id,
          status: releasedReservation.status,
          releasedAt: releasedReservation.releasedAt,
          productName: releasedReservation.product.name,
          warehouseName: releasedReservation.warehouse.name,
          quantity: releasedReservation.quantity,
        })
      } finally {
        if (lockId) {
          try {
            await releaseLock(`lock:reservation:${reservationId}`, lockId)
          } catch (e) {
            // Redis not available
          }
        }
      }
    } catch (dbError) {
      // Database not available, use mock data
      try {
        const releasedReservation = releaseMockReservation(reservationId)
        return NextResponse.json({
          id: releasedReservation.id,
          status: releasedReservation.status,
          releasedAt: releasedReservation.releasedAt,
          productName: releasedReservation.productName,
          warehouseName: releasedReservation.warehouseName,
          quantity: releasedReservation.quantity,
        })
      } catch (mockError: any) {
        return NextResponse.json(
          { error: mockError.message || 'Failed to release reservation' },
          { status: 400 }
        )
      }
    }
  } catch (error) {
    console.error('Error releasing reservation:', error)
    return NextResponse.json(
      { error: 'Failed to release reservation' },
      { status: 500 }
    )
  }
}
