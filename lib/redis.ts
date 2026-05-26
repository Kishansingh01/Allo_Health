import { createClient } from 'redis'

let client: ReturnType<typeof createClient> | null = null
let connectPromise: Promise<any> | null = null

export async function getRedisClient() {
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500), // Quick retry
        connectTimeout: 1000, // 1 second connection timeout
      },
    })

    client.on('error', (err) => console.log('Redis Client Error', err))
    
    // Try to connect in background, but don't wait for it in the critical path
    if (!connectPromise && !client.isOpen) {
      connectPromise = client.connect().catch(() => {
        // Connection failed, but that's OK - we'll use fallback
      }).finally(() => {
        connectPromise = null
      })
      
      // Don't await - just let it try to connect
    }
  }

  return client
}

export async function acquireLock(
  key: string,
  ttlSeconds: number = 30
): Promise<string | null> {
  try {
    const redis = await getRedisClient()
    
    // Only try if client is actually connected
    if (!redis.isOpen) {
      return null
    }
    
    const lockId = `lock-${Date.now()}-${Math.random()}`

    // Use SET with NX (only if not exists) and EX (expire)
    const result = await redis.set(key, lockId, {
      NX: true,
      EX: ttlSeconds,
    })

    return result ? lockId : null
  } catch (e) {
    // Redis not available, return null
    return null
  }
}

export async function releaseLock(key: string, lockId: string): Promise<boolean> {
  try {
    const redis = await getRedisClient()

    // Only try if client is actually connected
    if (!redis.isOpen) {
      return false
    }

    // Only delete if the lockId matches (to prevent releasing someone else's lock)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `

    const result = await redis.eval(script, {
      keys: [key],
      arguments: [lockId],
    })

    return result === 1
  } catch (e) {
    // Redis not available, return false
    return false
  }
}

export async function setWithExpiry(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  try {
    const redis = await getRedisClient()

    // Only try if client is actually connected
    if (!redis.isOpen) {
      return
    }
    
    await redis.setEx(key, ttlSeconds, value)
  } catch (e) {
    // Redis not available, skip
  }
}

export async function getFromRedis(key: string): Promise<string | null> {
  try {
    const redis = await getRedisClient()

    // Only try if client is actually connected
    if (!redis.isOpen) {
      return null
    }
    
    return await redis.get(key)
  } catch (e) {
    // Redis not available, return null
    return null
  }
}

export function isManagedRedis(url?: string) {
  if (!url) return false
  // Treat localhost and 127.0.0.1 as local development Redis
  return !/localhost|127\.0\.0\.1/.test(url)
}
