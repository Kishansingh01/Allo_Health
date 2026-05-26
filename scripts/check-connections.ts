import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { createClient } from 'redis'

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

const envPath = path.resolve(process.cwd(), '.env.local')
loadEnvFile(envPath)

async function checkPostgres() {
  const prisma = new PrismaClient()
  try {
    await prisma.$connect()
    console.log('Postgres: connected')
  } catch (e: any) {
    console.error('Postgres: connection failed -', e.message || e)
  } finally {
    try { await prisma.$disconnect() } catch (_) {}
  }
}

async function checkRedis() {
  const url = process.env.REDIS_URL || process.env.REDIS
  if (!url) {
    console.error('Redis: REDIS_URL not set')
    return
  }

  const client = createClient({ url })
  client.on('error', (err) => {
    // Node redis prints errors; we'll handle after trying to connect
  })

  try {
    await client.connect()
    const pong = await client.ping()
    console.log('Redis: connected - PING ->', pong)
  } catch (e: any) {
    console.error('Redis: connection failed -', e.message || e)
  } finally {
    try { await client.disconnect() } catch (_) {}
  }
}

async function main() {
  console.log('Using env file:', envPath)
  await checkPostgres()
  await checkRedis()
}

main().catch((e) => {
  console.error('Unexpected error', e)
  process.exit(1)
})
