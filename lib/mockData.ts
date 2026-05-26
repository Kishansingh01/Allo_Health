// Mock data for development/demo when database is not available

// Interface for global mock state to survive hot-reloads and route isolation in dev/prod
interface GlobalMock {
  mockReservations?: Map<string, any>
  mockProducts?: typeof mockProductsInitial
}

const globalWithMock = global as typeof globalThis & GlobalMock

export const mockWarehouses = [
  {
    id: 'wh-1',
    name: 'Warehouse Mumbai',
    location: 'Mumbai, India',
  },
  {
    id: 'wh-2',
    name: 'Warehouse Delhi',
    location: 'Delhi, India',
  },
]

const mockProductsInitial = [
  {
    id: 'prod-1',
    name: 'Premium Wireless Headphones',
    sku: 'HEADPHONE-001',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    stocks: [
      {
        warehouseId: 'wh-1',
        warehouseName: 'Warehouse Mumbai',
        total: 50,
        available: 50,
      },
      {
        warehouseId: 'wh-2',
        warehouseName: 'Warehouse Delhi',
        total: 30,
        available: 30,
      },
    ],
  },
  {
    id: 'prod-2',
    name: 'Smartphone Case',
    sku: 'CASE-002',
    image: 'https://picsum.photos/seed/smartphone-case/400/400',
    stocks: [
      {
        warehouseId: 'wh-1',
        warehouseName: 'Warehouse Mumbai',
        total: 100,
        available: 100,
      },
      {
        warehouseId: 'wh-2',
        warehouseName: 'Warehouse Delhi',
        total: 75,
        available: 75,
      },
    ],
  },
  {
    id: 'prod-3',
    name: 'Portable Charger',
    sku: 'CHARGER-003',
    image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop',
    stocks: [
      {
        warehouseId: 'wh-1',
        warehouseName: 'Warehouse Mumbai',
        total: 25,
        available: 25,
      },
      {
        warehouseId: 'wh-2',
        warehouseName: 'Warehouse Delhi',
        total: 40,
        available: 40,
      },
    ],
  },
]

// Initialize global state singletons
if (!globalWithMock.mockReservations) {
  globalWithMock.mockReservations = new Map()
}

if (!globalWithMock.mockProducts) {
  globalWithMock.mockProducts = JSON.parse(JSON.stringify(mockProductsInitial))
}

// Export references pointing to global singletons
export const mockReservations = globalWithMock.mockReservations!
export const mockProducts = globalWithMock.mockProducts!

export function getGlobalMockReservations() {
  if (!globalWithMock.mockReservations) {
    globalWithMock.mockReservations = new Map()
  }
  return globalWithMock.mockReservations
}

export function getMockReservations() {
  return getGlobalMockReservations()
}

export function createMockReservation(
  productId: string,
  warehouseId: string,
  quantity: number
) {
  const product = mockProducts.find((p) => p.id === productId)
  const warehouse = mockWarehouses.find((w) => w.id === warehouseId)

  if (!product || !warehouse) {
    throw new Error('Product or warehouse not found')
  }

  const stock = product.stocks.find((s) => s.warehouseId === warehouseId)
  if (!stock || stock.available < quantity) {
    throw new Error('Not enough stock')
  }

  const id = `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  const reservation = {
    id,
    productId,
    warehouseId,
    quantity,
    status: 'PENDING' as const,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
    productName: product.name,
    productSku: product.sku,
    productImage: product.image,
    warehouseName: warehouse.name,
    warehouseLocation: warehouse.location,
  }

  const reservations = getGlobalMockReservations()
  reservations.set(id, reservation)
  console.log('Created mock reservation:', id, 'Total in map:', reservations.size)

  // Decrease available stock in global mock data
  stock.available -= quantity

  return reservation
}

export function getReservation(id: string) {
  const reservations = getGlobalMockReservations()
  console.log('Getting reservation:', id, 'Available in map:', reservations.size, 'Keys:', Array.from(reservations.keys()))
  const reservation = reservations.get(id)
  if (!reservation) {
    throw new Error('Reservation not found')
  }
  return reservation
}

export function confirmReservation(id: string) {
  const reservations = getGlobalMockReservations()
  const reservation = reservations.get(id)
  if (!reservation) {
    throw new Error('Reservation not found')
  }

  if (reservation.status !== 'PENDING') {
    throw new Error(`Reservation is already ${reservation.status}`)
  }

  if (new Date() > new Date(reservation.expiresAt)) {
    throw new Error('Reservation expired')
  }

  reservation.status = 'CONFIRMED'
  reservation.confirmedAt = new Date().toISOString()
  reservations.set(id, reservation)

  return reservation
}

export function releaseReservation(id: string) {
  const reservations = getGlobalMockReservations()
  const reservation = reservations.get(id)
  if (!reservation) {
    throw new Error('Reservation not found')
  }

  if (reservation.status !== 'PENDING') {
    throw new Error(`Cannot release ${reservation.status} reservation`)
  }

  // Return stock to available
  const product = mockProducts.find((p) => p.id === reservation.productId)
  if (product) {
    const stock = product.stocks.find((s) => s.warehouseId === reservation.warehouseId)
    if (stock) {
      stock.available += reservation.quantity
    }
  }

  reservation.status = 'RELEASED'
  reservation.releasedAt = new Date().toISOString()
  reservations.set(id, reservation)

  return reservation
}
