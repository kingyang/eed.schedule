import util from 'node:util'

const {
  log: {
    console: isConsole,
    enable,
    persistentNum = -500,
    prefix: redisPrefix = '',
    redisDb = 2,
    serverKey,
    serverUrl,
    userId: userIdKey = 'userId',
  } = {},
  redis: redisCfg,
} = serverConfig

// 若和redis业务库是同一个db 则复用链接,否则新建链接
const redisInstance
  = redisCfg && redisCfg.db === redisDb
    ? redis
    : redisCfg && redisCfg.enable !== false
      ? redisNew({ ...redisCfg, db: redisDb })
      : null
const isLogEnable
  = enable !== false
  && redisCfg
  && serverUrl
  && serverKey
  && process.env.NODE_ENV === 'production'
const serverName = serverConfig.name
const redisLoggerKey = `${redisPrefix}logs`

/**
 * 异常格式化
 * @param items
 * @returns
 */
function format(items: any[]) {
  return items.map((item) => {
    if (item instanceof Error && item.stack) {
      return {
        inspect() {
          return `${util.format(item)}\n${item.stack}`
        },
      }
    }
    return util.format(item)
  })
}
/**
 * 保存日志数据
 * @param data
 * @returns
 */
function logSave(data: any) {
  return redisInstance
    ?.lpush(redisLoggerKey, JSON.stringify(data))
    .catch((err: any) => console.error('logPush', { err, log: data }))
}
const levelTypes = {
  debug: 0,
  error: 3,
  fatal: 4,
  info: 1,
  warn: 2,
}

type LevalNames = keyof typeof levelTypes

function createLevel(level: LevalNames, prefix?: string) {
  return (...args: any[]) => {
    if (isConsole || !isLogEnable || process.env.NODE_ENV !== 'production')
      console[level](new Date(), ...(prefix ? [prefix, ...args] : args))

    if (isLogEnable) {
      logSave({
        ct: Date.now(),
        ds: format(prefix ? [prefix, ...args] : args),
        l: levelTypes[level],
        s: serverName,
      })
    }
  }
}

export function create(prefix?: string) {
  return {
    debug: createLevel('debug', prefix),
    error: createLevel('error', prefix),
    fatal: createLevel('fatal', prefix),
    info: createLevel('info', prefix),
    warn: createLevel('warn', prefix),
  }
}

export const log = create()

export default log

/**
 * 获取ctx头信息
 * @param ctx
 * @param ext
 * @returns
 */
export function getCtxInfo(ctx: any /* Context */, ext?: any) {
  const {
    headers: { 'user-agent': requestUserAgent },
    method,
    request: { path: requestPath },
    state: { [userIdKey]: userId } = {},
  } = ctx

  const logData = {
    ct: Date.now(),
    ip:
      ctx.req.headers['x-forwarded-for']
      || ctx.req.connection.remoteAddress
      || ctx.req.socket.remoteAddress,
    l: 5,
    rm: method,
    rp: requestPath,
    rs: ctx.status,
    s: serverName,
    u: userId,
    ua: requestUserAgent,
    ...ext,
  }
  return logData
}

const mlFlags: Record<string, any> = {}

function logMonth(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(-2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${year}${month}`
}

/**
 * 加入文档
 * @param datas
 * @returns
 */
async function addDocuments(datas: string[]) {
  if (!datas || !datas.length)
    return

  const uid = `log${logMonth()}`
  if (!mlFlags[uid]) {
    const res = await $fetch<Record<string, any>>(`indexes/${uid}`, {
      headers: { Authorization: `Bearer ${serverKey}` },
    })
    if (res?.uid !== uid) {
      await $fetch(`indexes`, {
        body: {
          primaryKey: 'id',
          uid,
        },
        headers: { Authorization: `Bearer ${serverKey}` },
        method: 'POST',
      })
      await $fetch(`indexes/${uid}/settings`, {
        body: {
          displayedAttributes: ['*'],
          distinctAttribute: null,
          faceting: {
            maxValuesPerFacet: 100,
          },
          filterableAttributes: ['s', 'l', 'ct', 't'],
          pagination: {
            maxTotalHits: 1000,
          },
          rankingRules: [
            'words',
            'typo',
            'proximity',
            'attribute',
            'sort',
            'exactness',
          ],
          searchableAttributes: ['*'],
          sortableAttributes: ['ct'],
          stopWords: [],
          synonyms: {},
          typoTolerance: {
            disableOnAttributes: [],
            disableOnWords: [],
            enabled: true,
            minWordSizeForTypos: {
              oneTypo: 5,
              twoTypos: 9,
            },
          },
        },
        headers: { Authorization: `Bearer ${serverKey}` },
        method: 'patch',
      })
    }

    mlFlags[uid] = 1
  }
  return $fetch(`indexes/${uid}/documents`, {
    body: datas.map((i) => {
      const obj = JSON.parse(i)
      obj.id = nanoid(12)
      return obj
    }),
    headers: { Authorization: `Bearer ${serverKey}` },
    method: 'POST',
  })
}

export async function persistent() {
  if (!redisInstance)
    return

  const data = await redisInstance.lrange(redisLoggerKey, persistentNum, -1)
  if (data.length) {
    await addDocuments(data)
    return redisInstance.ltrim(redisLoggerKey, 0, -1 * data.length - 1)
  }
}
