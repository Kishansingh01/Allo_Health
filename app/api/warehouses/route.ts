import { NextRequest, NextResponse } from 'next/server'
import { mockWarehouses } from '@/lib/mockData'

export async function GET(_request: NextRequest) {
  try {
    let prisma: any = null
    if (process.env.DATABASE_URL) {
      const mod = await import('@/lib/prisma')
      prisma = mod.default
    }

    const warehouses = prisma
      ? await prisma.warehouse.findMany({
      orderBy: {
        name: 'asc',
      },
      })
      : []

    return NextResponse.json(warehouses)
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    // Fall back to mock data for demo
    return NextResponse.json(mockWarehouses)
  }
}
