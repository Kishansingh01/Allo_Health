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
    const products = await prisma.product.findMany()
    console.log('Products:')
    for (const p of products) {
      console.log(`- ${p.id} | ${p.sku} | image: ${p.image ?? '(none)'} | name: ${p.name}`)
    }

    // Fix missing images: set sensible defaults based on SKU
    const updates: Array<Promise<any>> = []
    for (const p of products) {
      if (!p.image) {
        let fallback = 'https://picsum.photos/seed/default/400/400'
        if (p.sku && p.sku.includes('CASE')) fallback = 'https://picsum.photos/seed/smartphone-case/400/400'
        if (p.sku && p.sku.includes('HEADPHONE')) fallback = 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop'
        if (p.sku && p.sku.includes('CHARGER')) fallback = 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop'

        console.log(`Updating ${p.sku} -> ${fallback}`)
        updates.push(prisma.product.update({ where: { id: p.id }, data: { image: fallback } }))
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates)
      console.log('Updated missing images.')
    } else {
      console.log('No missing images found.')
    }
  } catch (e) {
    console.error('Error:', e)
  } finally {
    await prisma.$disconnect()
  }
}

main()
