import { NextRequest, NextResponse } from 'next/server'
import { getReservation } from '@/lib/mockData'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    let prisma: any = null
    const hasDatabase = Boolean(process.env.DATABASE_URL)
    if (hasDatabase) {
      const mod = await import('@/lib/prisma')
      prisma = mod.default
    }
    console.log('Fetching reservation:', reservationId)

    // 1. Check if database is available
    let isDbAvailable = false
    try {
      await prisma.$queryRaw`SELECT 1`
      isDbAvailable = true
    } catch (e) {
      console.log('Database not available for GET reservation, using mock mode.')
    }

    // 2. Database Path
    if (isDbAvailable) {
      try {
        const dbReservation = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                image: true,
              },
            },
            warehouse: {
              select: {
                name: true,
                location: true,
              },
            },
          },
        })

        if (dbReservation) {
          return NextResponse.json({
            id: dbReservation.id,
            productId: dbReservation.productId,
            productName: dbReservation.product.name,
            productSku: dbReservation.product.sku,
            productImage: dbReservation.product.image,
            warehouseId: dbReservation.warehouseId,
            warehouseName: dbReservation.warehouse.name,
            warehouseLocation: dbReservation.warehouse.location,
            quantity: dbReservation.quantity,
            status: dbReservation.status,
            expiresAt: dbReservation.expiresAt.toISOString(),
            confirmedAt: dbReservation.confirmedAt?.toISOString() || null,
            releasedAt: dbReservation.releasedAt?.toISOString() || null,
            createdAt: dbReservation.createdAt.toISOString(),
          })
        }
      } catch (dbError: any) {
        console.error('Database fetch error, falling back to mock:', dbError.message)
      }
    }

    // 3. Graceful Fallback Path: Fetch from global mock Map
    try {
      const mockReservation = getReservation(reservationId)
      console.log('Found reservation in mock data:', mockReservation)
      return NextResponse.json({
        id: mockReservation.id,
        productId: mockReservation.productId,
        productName: mockReservation.productName,
        productSku: mockReservation.mockSku || mockReservation.productSku,
        productImage: mockReservation.productImage,
        warehouseId: mockReservation.warehouseId,
        warehouseName: mockReservation.warehouseName,
        warehouseLocation: mockReservation.warehouseLocation,
        quantity: mockReservation.quantity,
        status: mockReservation.status,
        expiresAt: mockReservation.expiresAt,
        confirmedAt: mockReservation.confirmedAt,
        releasedAt: mockReservation.releasedAt,
        createdAt: mockReservation.createdAt,
      })
    } catch (mockError: any) {
      console.error('Mock error:', mockError.message)
      return NextResponse.json(
        { error: 'Reservation not found' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error fetching reservation:', error)
    return NextResponse.json(
      { error: 'Reservation not found' },
      { status: 404 }
    )
  }
}
