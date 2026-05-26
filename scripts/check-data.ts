import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

function loadEnvFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  } catch (e) {
    // ignore
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'))

async function main() {
  const prisma = new PrismaClient()
  try {
    await prisma.$connect()
    const products = await prisma.product.count()
    const warehouses = await prisma.warehouse.count()
    const stocks = await prisma.stock.count()
    const reservations = await prisma.reservation.count()

    console.log('DB counts:')
    console.log('  products:', products)
    console.log('  warehouses:', warehouses)
    console.log('  stocks:', stocks)
    console.log('  reservations:', reservations)
  } catch (e) {
    console.error('Error querying DB:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
