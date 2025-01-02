import type { RedisOptions } from 'ioredis'

import Redis from 'ioredis'

const { redis: options } = serverConfig

export const redis: Redis = (options
  && options.enable !== false
  && new Redis(options)) as any as Redis

/**
 * 获取新实例
 * @returns
 */
export function redisNew(opt?: Partial<RedisOptions>) {
  return new Redis({ ...options, ...opt })
}

const DEFAULT_TIMEOUT = 5000
const DEFAULT_RETRY_DELAY = 50

async function acquireLock(
  lockName: string,
  timeout: number,
  retryDelay: number,
  onLockAcquired: Function,
) {
  function retry() {
    setTimeout(() => {
      acquireLock(lockName, timeout, retryDelay, onLockAcquired)
    }, retryDelay)
  }

  const lockTimeoutValue = Date.now() + timeout + 1
  try {
    const result = await redis.set(
      lockName,
      lockTimeoutValue,
      'PX',
      timeout,
      'NX',
    )
    if (result === null)
      throw new Error('Lock failed')
    onLockAcquired(lockTimeoutValue)
  }
  catch (err) {
    retry()
  }
}

export async function redisLock(
  lockName: string,
  timeout = DEFAULT_TIMEOUT,
  retryDelay = DEFAULT_RETRY_DELAY,
): Promise<Function> {
  if (!lockName) {
    throw new Error(
      'You must specify a lock string. It is on the redis key `lock.[string]` that the lock is acquired.',
    )
  }
  return new Promise((resolve) => {
    lockName = `lock.${lockName}`
    acquireLock(lockName, timeout, retryDelay, (lockTimeoutValue: number) => {
      resolve(async () => {
        if (lockTimeoutValue > Date.now())
          return redis.del(lockName)
      })
    })
  })
}
