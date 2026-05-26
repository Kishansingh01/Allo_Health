import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clear existing data
  await prisma.reservation.deleteMany()
  await prisma.stock.deleteMany()
  await prisma.product.deleteMany()
  await prisma.warehouse.deleteMany()

  // Create warehouses
  const warehouse1 = await prisma.warehouse.create({
    data: {
      name: 'Warehouse Mumbai',
      location: 'Mumbai, India',
    },
  })

  const warehouse2 = await prisma.warehouse.create({
    data: {
      name: 'Warehouse Delhi',
      location: 'Delhi, India',
    },
  })

  // Create products
  const product1 = await prisma.product.create({
    data: {
      name: 'Premium Wireless Headphones',
      sku: 'HEADPHONE-001',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
    },
  })

  const product2 = await prisma.product.create({
    data: {
      name: 'Smartphone Case',
      sku: 'CASE-002',
      image: 'https://images.unsplash.com/photo-1592286927505-cd966f8646f1?w=400&h=400&fit=crop',
    },
  })

  const product3 = await prisma.product.create({
    data: {
      name: 'Portable Charger',
      sku: 'CHARGER-003',
      image: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop',
    },
  })

  // Create stock levels
  await prisma.stock.createMany({
    data: [
      {
        productId: product1.id,
        warehouseId: warehouse1.id,
        total: 50,
        reserved: 0,
      },
      {
        productId: product1.id,
        warehouseId: warehouse2.id,
        total: 30,
        reserved: 0,
      },
      {
        productId: product2.id,
        warehouseId: warehouse1.id,
        total: 100,
        reserved: 0,
      },
      {
        productId: product2.id,
        warehouseId: warehouse2.id,
        total: 75,
        reserved: 0,
      },
      {
        productId: product3.id,
        warehouseId: warehouse1.id,
        total: 25,
        reserved: 0,
      },
      {
        productId: product3.id,
        warehouseId: warehouse2.id,
        total: 40,
        reserved: 0,
      },
    ],
  })

  console.log('Seed completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
