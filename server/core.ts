import crc32 from 'crc-32'
import cronParser from 'cron-parser'
import pFilter from 'p-filter'
import pMap from 'p-map'

import type { Project, Task, TaskInfo, TaskKey } from './types'

const { schedule: { concurrency: concurrencyDef = 30, prefix } = {} }
  = serverConfig

/**
 * redis订阅频道名称
 */
export const channelName = `${prefix}schedule-channel`

/**
 * RedisKey:配置
 */
const rkCfg = `${prefix}schedule:cfg`

/**
 * RedisKey:jobs
 */
export const rkTask = `${prefix}schedule:tasks`

/**
 * RedisKey:worker
 */
export const rkWorkLive = `${prefix}schedule:worker`

/**
 * 当前worker编号
 */
export const currentWorkerId = nanoid(4)

const rkWorkerTask = (workerId: string) => `${rkWorkLive}:${workerId}`

/**
 * RedisKey:processing
 * @param {*} taskName
 */
const rkDoing = (taskName: string) => `${prefix}schedule:doning:${taskName}`

/**
 * RedisKey:queue
 * @param {*} taskName
 */
const rkQueue = (taskName: string) => `${prefix}schedule:queue:${taskName}`

const intervalLock = `${prefix}schedule:lock`

/**
 * 任务配置
 * @param name
 * @returns
 */
function prjCfgGet(name: string) {
  return redis
    .hget(rkCfg, name)
    .then(data => data && (JSON.parse(data) as Project))
}

/**
 * 获取任务hash值
 * @param {*} name
 * @param {*} keys
 */
export function getKey({ key, keys, name }: TaskKey) {
  if (key) {
    return key
  }
  if (!name) {
    throw new Error('请输入任务名称')
  }
  key = `${name}`
  if (keys) {
    if (Array.isArray(keys)) {
      if (keys.length) {
        key = `${key};${keys.join('-')}`
      }
    }
    else {
      key = `${key};${keys}`
    }
  }
  return `${crc32.str(key)}`
}

/**
 * 向master发送消息
 * @param {*} workerId
 * @param {*} cmd
 * @param {*} key
 * @param {*} ext
 */
function publish(workerId: string, cmd: string, key: string, ext?: any) {
  return redis.publish(
    channelName,
    JSON.stringify({
      cmd,
      ext,
      id: workerId,
      key,
    }),
  )
}

/**
 * work 心跳时间
 */
const workerHeartbeat = 5 * 1000

/**
 * 是否活跃
 * @param time
 * @returns
 */
function isLive(time: string): boolean {
  return (
    (time
    && new Date().getTime() - Number.parseInt(time, 10) <= workerHeartbeat)
    || false
  )
}

/**
 * 查找工作器
 * @param {*} workerId
 */
async function getWorker(workerId: string) {
  const workerLives = await redis.hgetall(rkWorkLive)
  if (isEmpty(workerLives)) {
    return
  }
  if (workerId) {
    const time = workerLives[workerId]
    if (
      time
      && new Date().getTime() - Number.parseInt(time, 10) <= workerHeartbeat
    ) {
      return workerId
    }
  }
  const workerIds = Object.keys(workerLives).filter((workerId) => {
    const time = workerLives[workerId]
    return isLive(time)
  })
  if (workerIds.length === 0) {
    return
  }
  const workerJobs = await pMap(
    workerIds,
    workerId =>
      redis
        .smembers(rkWorkerTask(workerId))
        .then(tasks => [workerId, tasks] as [string, string[]]),
    { concurrency: 20 },
  )
  if (workerId === 'all') {
    return workerJobs.reduce((r, [workerId, tasks]) => {
      r[workerId] = tasks
      return r
    }, {} as Record<string, string[]>)
  }
  workerJobs.sort(([, tasksA], [, tasksB]) => {
    return (tasksA.length || 0) - (tasksB.length || 0)
  })
  const [id] = workerJobs[0] as [string, string[]]
  return id
}

/**
 * 广播清理任务(保证只有一个任务在执行)
 * @param {*} key
 * @param {*} workerId
 */
async function cancelPublish(key: string, workerId?: string) {
  const workerLives = await redis.hgetall(rkWorkLive)
  const workerIds = Object.keys(workerLives)
  if (workerLives && workerIds.length) {
    return pMap(workerIds, async (id) => {
      if (workerId !== id) {
        return publish(id, 'cancel', key)
      }
    })
  }
}

/**
 * 加入等待队列
 * @param {*} param0
 */
async function queueIn({ delayCount = 0, key, keys, name, queueDate }: Task) {
  key = getKey({ key, keys, name })
  const isExists = await redis.hexists(rkQueue(name), key)
  if (isExists) {
    delayCount += 1
  }
  queueDate = (queueDate && new Date(queueDate)) || new Date()
  return Promise.all([
    redis.hdel(rkTask, key),
    redis.hset(
      rkQueue(name),
      key,
      JSON.stringify({
        delayCount,
        key,
        keys,
        name,
        queueDate,
      }),
    ),
    cancelPublish(key),
  ]).then(() => {
    log.debug('master queueIn', { key, keys, name })
  })
}

/**
 * 取消项目
 * @param {*} args
 */
export async function taskCancel(args: TaskKey, next = 0) {
  let { key, name } = args
  if (!name) {
    const jobStr = await redis.hget(rkTask, key)
    const job = ((jobStr && JSON.parse(jobStr)) || {}) as TaskInfo;
    ({ name } = job)
  }
  await globalThis.Promise.all([
    cancelPublish(key),
    redis.hdel(rkTask, key),
    redis.hdel(rkQueue(name), key),
    redis.hget(rkDoing(name), key).then((workerId) => {
      if (workerId)
        redis.srem(rkWorkerTask(workerId), key)
      redis.hdel(rkDoing(name), key)
    }),
  ])

  // 检测下一工作
  if (next === 1) {
    // 随机延迟 减少高并发任务同时触发检测任务的可能性
    taskNextCheck(name, 1)
  }
}

/**
 * 任务开始
 */
async function taskStartInternal(
  { delayCount = 0, key, keys, name, queueDate }: Task,
  flag?: number,
) {
  key = getKey({ key, keys, name })
  const prjCfg = await prjCfgGet(name)
  if (!prjCfg) {
    return taskCancel({ key, keys, name })
  }
  if (prjCfg.status !== undefined && !prjCfg.status) {
    // 项目停止状态 则清理任务并加入到队列中
    await taskCancel({ key, keys, name })
    if (prjCfg.mode === 1) {
      await queueIn({
        delayCount,
        key,
        keys,
        name,
        queueDate,
      })
    }
    return
  }
  const { concurrency = concurrencyDef } = prjCfg
  if (!flag && concurrency >= 1) {
    const processingKeys = await redis.hkeys(rkDoing(name))
    if (!processingKeys.includes(key) && processingKeys.length >= concurrency) {
      return queueIn({
        delayCount,
        key,
        keys,
        name,
        queueDate,
      })
    }
  }
  const jobInfoStr = await redis.hget(rkTask, key)
  const jobInfo = (jobInfoStr && JSON.parse(jobInfoStr)) || {
    delayCount,
    key,
    keys,
    name,
    queueDate,
  }

  const workerId = (await getWorker(jobInfo.workerId)) as string
  if (!workerId) {
    log.error('master', 'jobStartInternal 无worker')
    return queueIn({
      delayCount,
      key,
      keys,
      name,
      queueDate,
    })
  }
  jobInfo.cron = prjCfg.cron
  jobInfo.url = prjCfg.url
  jobInfo.delay = prjCfg.delay
  jobInfo.delayMax = prjCfg.delayMax
  jobInfo.workerId = workerId
  await redis.hset(rkTask, key, JSON.stringify(jobInfo))
  await Promise.all([
    publish(workerId, 'start', key, flag),
    cancelPublish(key, workerId),
  ])
  await redis.sadd(rkWorkerTask(workerId), key)
  if (prjCfg.mode !== 0) {
    await redis.hset(rkDoing(name), key, workerId)
  }
}

export async function taskStart(args: Task) {
  const { name } = args
  const jobCfg = await prjCfgGet(name)
  if (!jobCfg) {
    throw new Error(`项目${name}不存在`)
  }
  if (jobCfg.status !== undefined && !jobCfg.status) {
    throw new Error(`项目${name}已停止`)
  }
  setTimeout(() => {
    taskStartInternal(args)
  })
}

/**
 * 检查等待队列
 * @param {*} name
 * @param {*} num
 */
export async function taskNextCheck(name: string, num = 0) {
  const jobCfg = await prjCfgGet(name)
  if (
    jobCfg
    && jobCfg.mode !== 0
    && (jobCfg.status === undefined || jobCfg.status)
  ) {
    const { concurrency = concurrencyDef } = jobCfg
    if (concurrency >= 1) {
      await pMap(
        Array.from({ length: num || concurrency }),
        async () => {
          const processingCount = await redis.hlen(rkDoing(name))
          if (processingCount < concurrency) {
            // 检查下一个工作
            const [, [field, value] = []] = await redis.hscan(
              rkQueue(name),
              0,
              'COUNT',
              1,
            )
            if (field) {
              const nextObj = JSON.parse(value) as TaskInfo
              await Promise.all([
                redis.hdel(rkQueue(name), field),
                taskStartInternal(nextObj, 1),
              ])
              log.debug('master queueOut', value)
            }
          }
        },
        { concurrency: 1 },
      )
    }
  }
}

/**
 * 验证配置是否有效
 * @param {*} v
 */
const isPrjValid = (v: Project) => v.name && v.cron && v.url
/**
 * 任务编辑
 * @param {*} prj
 */
export function prjEdit(prj: Project) {
  if (!isPrjValid(prj)) {
    return Promise.reject(new Error('必须包含name cron url'))
  }
  if (prj.status === undefined) {
    prj.status = 1
  }
  return redis
    .hset(rkCfg, prj.name, JSON.stringify(prj))
    .then(() => prjInit(prj.name))
}

/**
 * 批量任务编辑
 * @param {*} prjs
 */
export function prjEdits(prjs: Record<string, Project>) {
  const errKeys = reduce(
    prjs,
    (res, v, k) => {
      if (!isPrjValid(v)) {
        res.push(k)
      }
      return res
    },
    [] as string[],
  )
  if (errKeys.length) {
    return Promise.reject(
      new Error(
        `${errKeys.join(' ')}必须包含name cron args.url,且name不能为all check`,
      ),
    )
  }
  const values = Object.values(prjs)
  return pMap(
    values,
    async (val) => {
      await redis.hset(rkCfg, val.name, JSON.stringify(val))
      await prjInit(val.name)
    },
    { concurrency: 1 },
  )
}

/**
 * 项目移除(清理任务和配置)
 * @param {*} name
 */
export async function prjRemove(name: string) {
  await prjClear(name)
  redis.hdel(rkCfg, name)
}

/**
 * 项目清理(仅清理任务)
 * @param {*} name
 */
export async function prjClear(name: string) {
  const jobs = await redis.hgetall(rkTask)
  if (jobs) {
    await pMap(
      Object.keys(jobs),
      async (k) => {
        const job = JSON.parse(jobs[k])
        if (job.name === name) {
          taskCancel(job)
        }
      },
      { concurrency: 1 },
    )
  }
  await Promise.all([
    redis.hdel(rkTask, name),
    redis.del(rkDoing(name)),
    redis.del(rkQueue(name)),
  ])
}

/**
 * 项目初始化
 * @param name 项目名称
 * @param status 项目状态 undefined 重启| 0 停用 | 1 启用
 */
export async function prjInit(name: string, status?: 0 | 1) {
  log.debug('master', 'prjInit', name)
  // 初始化单个项目
  const [prjCfgStr, tasks = {}] = await Promise.all([
    redis.hget(rkCfg, name),
    redis.hgetall(rkTask),
    // 删除处理中的任务 根据tasks重新启动
    redis.del(rkDoing(name)),
  ])
  if (prjCfgStr) {
    const prjCfg = JSON.parse(prjCfgStr) as Project
    if (status !== undefined) {
      prjCfg.status = status
      redis.hset(rkCfg, name, JSON.stringify(prjCfg))
    }
    if (prjCfg.mode === 0) {
      await prjClear(prjCfg.name)
      const { concurrency = 1 } = prjCfg
      if (concurrency > 1) {
        await pMap(
          Array.from({ length: concurrency }),
          async (v, i) => {
            await delay(50)
            return taskStartInternal({ ...prjCfg, keys: [i] }, 1)
          },
          { concurrency: 1 },
        )
      }
      else {
        await taskStartInternal(prjCfg, 1)
      }
    }
  }
  if (tasks) {
    await pMap(
      Object.keys(tasks),
      async (k) => {
        const job = JSON.parse(tasks[k])
        if (job.name === name) {
          taskStartInternal(job, 1)
        }
      },
      { concurrency: 1 },
    )
  }
  await taskNextCheck(name)
}

/**
 * 测试cron表达式
 * @param {*} param0
 * @param {*} count
 */
export function prjCronTest(
  { cron, name }: Project,
  count: string,
): Promise<any> {
  try {
    if (!cron) {
      throw new Error('cron 不能为空')
    }
    const interval = cronParser.parseExpression(cron)
    const nexts = []
    const num = count ? Number.parseInt(count as string, 10) : 100
    for (let index = 0; index < num; index++) {
      nexts.push(interval.next().toString())
    }
    return Promise.resolve({ cron, name, nexts })
  }
  catch (error: any) {
    return Promise.resolve({ cron, error: error?.message, name })
  }
}

/**
 * 任务状态
 */
export async function getStatus() {
  const [prjs, tasks = {}, doing = {}, queues = {}, workers]
    = await Promise.all([
      redis.hgetall(rkCfg).then((res) => {
        each(res, (v, k) => {
          res[k] = JSON.parse(v)
        })
        return res
      }),
      redis.hgetall(rkTask).then((res) => {
        each(res, (v, k) => {
          res[k] = JSON.parse(v)
        })
        return res
      }),
      redis.keys(rkDoing('*')).then(keys =>
        pMap(keys, key =>
          redis.hkeys(key).then(res => [key, res] as [string, string[]])).then(data =>
          data.reduce((r, [key, res]) => {
            const segs = key.split(':')
            r[segs[segs.length - 1]] = res
            return r
          }, {} as Record<string, string[]>),
        ),
      ),
      redis.keys(rkQueue('*')).then(keys =>
        pMap(keys, rkey => redis.hvals(rkey)).then(data =>
          data.reduce((r, items) => {
            const arr = items.map(v => JSON.parse(v))
            const [{ name }] = arr
            r[`${name}_c`] = arr.length
            r[name] = arr
            return r
          }, {} as Record<string, any>),
        ),
      ),
      getWorker('all'),
    ])

  return {
    doing,
    prjs,
    queues,
    tasks,
    workerId: currentWorkerId,
    workers,
  }
}

// 定时监控
export const interval = process.env.NODE_ENV === 'development' ? 10000 : 120000
export async function checker() {
  const lastTime = Number.parseInt((await redis.get(intervalLock)) || '0', 10)
  const now = new Date().getTime()
  if (now - lastTime > interval) {
    log.info('master checker working')
    redis.set(intervalLock, now)
    // 清理异常worker
    const [dedWorkers, liveWorkers] = Object.entries(
      await redis.hgetall(rkWorkLive),
    ).reduce(
      (r, [workerId, time]) => {
        if (now - Number.parseInt(time, 10) > workerHeartbeat) {
          r[0].push(workerId)
        }
        else {
          r[1].push(workerId)
        }
        return r
      },
      [[] as string[], [] as string[]],
    )
    // 清理异常worker
    await pMap(dedWorkers, workerId =>
      Promise.all([
        redis.hdel(rkWorkLive, workerId),
        redis.del(rkWorkerTask(workerId)),
      ]))
    // 清理worker异常任务
    await pMap(liveWorkers, workerId =>
      redis.smembers(rkWorkerTask(workerId)).then(async taskKeys =>
        pFilter(taskKeys, key =>
          redis.hexists(rkTask, key).then(isExists => !isExists)).then((dels) => {
          if (dels.length) {
            log.info('master interval 清理worker异常任务', workerId, dels)
            return redis.srem(rkWorkerTask(workerId), ...dels)
          }
        }),
      ))

    // 检查工作队列
    const tasks = await redis.hgetall(rkTask)
    if (tasks) {
      await pMap(
        Object.keys(tasks),
        async (k) => {
          const jobCfg = JSON.parse(tasks[k])
          return taskStartInternal(jobCfg, 2)
        },
        { concurrency: 1 },
      )
    }

    // 检查等待队列
    const queueKeys = await redis.keys(rkQueue('*'))
    if (queueKeys && queueKeys.length) {
      await pMap(
        queueKeys,
        (key) => {
          const segs = key.split(':')
          const jobName = segs[segs.length - 1]
          return taskNextCheck(jobName)
        },
        { concurrency: 1 },
      )
    }

    const doingKeys = await redis.keys(rkDoing('*'))
    if (doingKeys && doingKeys.length) {
      await pMap(doingKeys, async (key) => {
        const taskKeys = await redis.hkeys(key)
        const dels = await pFilter(taskKeys, key =>
          redis.hexists(rkTask, key).then(isExists => !isExists))
        if (dels.length > 0) {
          await redis.hdel(key, ...dels)
          const segs = key.split(':')
          const jobName = segs[segs.length - 1]
          log.info('master interval 清理doing异常任务', jobName, dels)
        }
      })
    }

    // 清理doing异常任务
    await pMap(liveWorkers, workerId =>
      redis.smembers(rkWorkerTask(workerId)).then(async keys =>
        pFilter(keys, key =>
          redis.hexists(rkTask, key).then(isExists => !isExists)).then((dels) => {
          if (dels.length) {
            log.info('master interval 清理worker异常任务', workerId, dels)
            return redis.srem(rkWorkerTask(workerId), ...dels)
          }
        }),
      ))
  }
  else {
    log.info('master checker skipped')
  }
}
