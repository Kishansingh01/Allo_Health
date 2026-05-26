import { NextRequest, NextResponse } from 'next/server'
import { mockProducts } from '@/lib/mockData'

export async function GET(_request: NextRequest) {
  try {
    // Use mock data directly for demo mode (database unavailable)
    return NextResponse.json(mockProducts)
  } catch (error) {
    console.error('Error fetching products:', error)
    // Fall back to mock data
    return NextResponse.json(mockProducts)
  }
}
