import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { mockProducts } from '@/lib/mockData'

export async function GET(_request: NextRequest) {
  try {
    // Prefer database when available
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: { warehouse: true },
        },
      },
    })

    // Map to the same shape as mockProducts
    const mapped = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image: p.image,
      stocks: p.stocks.map((s) => ({
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
