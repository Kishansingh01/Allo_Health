import { NextRequest, NextResponse } from 'next/server'
import { mockProducts } from '@/lib/mockData'

export async function GET(_request: NextRequest) {
  try {
    // Only import Prisma when a DATABASE_URL is provided (prevents build-time DB access)
    let prisma: any = null
    if (process.env.DATABASE_URL) {
      const mod = await import('@/lib/prisma')
      prisma = mod.default
    }

    const products = prisma
      ? await prisma.product.findMany({
          include: {
            stocks: {
              include: { warehouse: true },
            },
          },
        })
      : []

    if (products.length === 0) {
      return NextResponse.json(mockProducts)
    }

    // Map to the same shape as mockProducts
    const mapped = (products as any[]).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image: p.image,
      stocks: (p.stocks as any[]).map((s: any) => ({
        warehouseId: s.warehouseId,
        warehouseName: s.warehouse.name,
        total: s.total,
        available: s.total - s.reserved,
      })),
    }))

    return NextResponse.json(mapped)
  } catch (error) {
    console.error('Error fetching products from DB, falling back to mock:', error)
    // Fall back to mock data for demo
    return NextResponse.json(mockProducts)
  }
}
