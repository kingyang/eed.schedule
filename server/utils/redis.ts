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
