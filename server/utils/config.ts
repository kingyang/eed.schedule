import type { RedisOptions } from 'ioredis'

import dotenv from 'dotenv'

dotenv.config()

interface Enable {
  enable?: boolean
}

export interface ScheduleConfig {
  /**
   * 默认并发数
   */
  concurrency: number
  /**
   * 延迟执行时间
   */
  delay: number

  /**
   * 最多延迟次数
   */
  delayMax: number

  /**
   * redis前缀
   */
  prefix: string
}

/**
 * 服务端配置
 */
export interface ServerPrivateConfig {
  /**
   * 日志
   */
  log: {
    /**
     * 是否开启控制台
     */
    console: boolean
    /**
     * 是否启用
     */
    enable: boolean
    /**
     * 持久化批次量(负数)
     */
    persistentNum: number
    /**
     * redis前缀
     */
    prefix?: string
    /**
     * 默认为2, 日志存储db
     */
    redisDb: number
    /**
     * 日志库秘钥
     */
    serverKey: string
    /**
     * 日志服务地址
     */
    serverUrl: string

    /**
     * 用户身份键值
     */
    userId?: string
  }
  /**
   * 应用名称
   */
  name: string
  /**
   * redis
   */
  redis: Enable & RedisOptions
  /**
   * 调度服务配置
   */
  schedule: ScheduleConfig
  /**
   * 秘钥
   */
  secrets: string[]
}

function toNumber(defVal: number, str?: string): number {
  return str === undefined ? defVal : Number(str)
}
function toBool(defVal: boolean, str?: string): boolean {
  switch (str) {
    case undefined:
      return defVal
    case '':
    case '0':
    case 'false':
      return false
  }
  return true
}

const redisConfig: ServerPrivateConfig['redis'] = {
  enable: toBool(true, process.env.SERVER_REDIS_ENABLE),
  db: (process.env.SERVER_REDIS_DB && Number(process.env.SERVER_REDIS_DB)) || 0,
  host: process.env.SERVER_REDIS_HOST || '',
  password: process.env.SERVER_REDIS_PASSWORD,
  port: toNumber(6379, process.env.SERVER_REDIS_PORT),
  username: process.env.SERVER_REDIS_USERNAME,
}
redisConfig.enable = redisConfig.enable && !!redisConfig.host && !!redisConfig.username && !!redisConfig.password

const logConfig: ServerPrivateConfig['log'] = {
  console: toBool(true, process.env.SERVER_LOG_CONSOLE),
  enable: toBool(true, process.env.SERVER_LOG_ENABLE),
  persistentNum: toNumber(-500, process.env.SERVER_LOG_PERSISTENTNUM),
  prefix: process.env.SERVER_LOG_PREFIX || '',
  redisDb: toNumber(2, process.env.SERVER_LOG_REDISDB),
  serverKey: process.env.SERVER_LOG_SERVERKEY || '',
  serverUrl: process.env.SERVER_LOG_SERVERURL || '',
}

export const serverConfig: ServerPrivateConfig = {
  log: logConfig,
  name: process.env.App_NAME || '@eed/schedule',
  redis: redisConfig,
  schedule: {
    concurrency: toNumber(10, process.env.SCHEDULE_CONCURRENCY),
    delay: toNumber(30, process.env.SCHEDULE_DELAY),
    delayMax: toNumber(30, process.env.SCHEDULE_DELAYMAX),
    prefix: process.env.SCHEDULE_PREFIX || 'eed-',
  },
  secrets: process.env.SECRETS ? (process.env.SECRETS || '').split(',').map(x => x.trim()) : [],
}

console.info(`NODE_ENV: ${process.env.NODE_ENV || ''}`)
