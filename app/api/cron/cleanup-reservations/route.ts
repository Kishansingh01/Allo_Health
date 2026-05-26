import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// This route can be called by Vercel Crons to clean up expired reservations
// Vercel crons doc: https://vercel.com/docs/crons
export async function POST(request: NextRequest) {
  // Verify cron secret if provided
  if (process.env.CRON_SECRET) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  try {
    // Find all PENDING reservations that have expired
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date(),
        },
      },
      include: {
        product: { select: { name: true } },
      },
    })

    if (expiredReservations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired reservations to clean up',
        count: 0,
      })
    }

    // Release each expired reservation in a transaction
    const releaseResults = await Promise.all(
      expiredReservations.map((reservation) =>
        prisma.$transaction(async (tx) => {
          // Release the reserved units
          await tx.stock.update({
            where: {
              productId_warehouseId: {
                productId: reservation.productId,
                warehouseId: reservation.warehouseId,
              },
            },
            data: {
              reserved: {
                decrement: reservation.quantity,
              },
            },
          })

          // Mark reservation as released
          return await tx.reservation.update({
            where: { id: reservation.id },
            data: {
              status: 'RELEASED',
              releasedAt: new Date(),
            },
          })
        })
      )
    )

    console.log(`Cleaned up ${releaseResults.length} expired reservations`)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${releaseResults.length} expired reservations`,
      count: releaseResults.length,
    })
  } catch (error) {
    console.error('Error cleaning up expired reservations:', error)
    return NextResponse.json(
      { error: 'Failed to clean up expired reservations' },
      { status: 500 }
    )
  }
}
