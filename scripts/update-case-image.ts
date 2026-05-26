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
    const sku = 'CASE-002'
    const fallback = 'https://picsum.photos/seed/smartphone-case/400/400'
    const prod = await prisma.product.findUnique({ where: { sku } })
    if (!prod) {
      console.error('Product with sku not found:', sku)
      return
    }
    console.log('Before:', prod.sku, prod.image)
    await prisma.product.update({ where: { sku }, data: { image: fallback } })
    const after = await prisma.product.findUnique({ where: { sku } })
    console.log('After:', after?.sku, after?.image)
  } catch (e) {
    console.error('Error updating image:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
