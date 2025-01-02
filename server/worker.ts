import type { Job } from 'node-schedule'

import schedule from 'node-schedule'

import type { TaskInfo, WorkerTaskStatus } from './types'

import { channelName, currentWorkerId, rkTask, rkWorkLive } from './core'

const {
  schedule: cfgSchedule = {
    delay: 30,
    delayMax: 30,
  },
} = serverConfig

function safeStringify(obj: any, indent: number) {
  const cache: any[] = []
  return JSON.stringify(
    obj,
    (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (cache.includes(val))
          return
        cache.push(val)
      }
      return val
    },
    indent,
  )
}

const jobStatuses: Record<string, WorkerTaskStatus> = {}
const defaultRequestConfig: Partial<RequestConfig> = {
  headers: {
    'content-type': 'application/json',
  },
  method: 'POST',
}

function saveJob(name: string, obj: TaskInfo, ...args: any[]) {
  const jobSting = safeStringify(obj, 4)
  log.debug('worker', name, '\n', jobSting, ...args)
  return redis.hset(rkTask, obj.key, jobSting)
}

function getTask(key: string) {
  return redis.hget(rkTask, key).then(v => (v && JSON.parse(v)) as TaskInfo)
}

/**
 * 检查job的状态
 * @param {*} jobInfo
 * @param {*} jobStatus
 * @param {*} session
 * @param {*} job
 * @param {*} flag
 * @returns
 */
function checkJob(
  jobInfo: TaskInfo,
  jobStatus: WorkerTaskStatus,
  session: string,
  job: Job,
  flag: string,
) {
  // 检查会话状态
  if (jobStatus.session !== session) {
    const cancelFlag = job.cancel()
    log.warn(
      'worker',
      `会话丢失---${flag}`,
      session,
      cancelFlag,
      safeStringify(jobInfo, 4),
      safeStringify(jobStatus, 4),
    )
    return true
  }
  // 检查任务状态
  if (!jobStatuses[jobInfo.key]) {
    const cancelFlag = job.cancel()
    log.warn(
      'worker',
      `丢弃该任务--${flag}`,
      cancelFlag,
      safeStringify(jobInfo, 4),
    )
    return true
  }
}

async function createJob(jobInfo: TaskInfo, jobStatus: WorkerTaskStatus) {
  if (jobStatus.delayTimer) {
    clearTimeout(jobStatus.delayTimer)
  }
  if (jobStatus.job) {
    jobStatus.job.cancel()
  }
  delete jobStatus.delayTimer
  delete jobInfo.delayCount
  delete jobInfo.queueDate

  const session = nanoid(8)
  // 任务会话, 创建时更新
  jobStatus.session = session
  const { cron, url } = jobInfo
  jobStatus.job = schedule.scheduleJob(cron.trim(), function (this: Job) {
    const job = this as Job
    jobInfo.next = job.nextInvocation()
    jobStatus.nextInvocation = jobInfo.next
    if (checkJob(jobInfo, jobStatus, session, job, '2')) {
      return
    }
    jobInfo.scheduleDate = new Date()
    if (jobStatus.busy) {
      jobInfo.round = (jobInfo.round || 0) + 1
      saveJob('task busying', jobInfo)
      return
    }
    jobStatus.busy = 1
    jobInfo.busy = 1
    jobInfo.round = 1
    jobInfo.handleDate = new Date()

    const controller = new AbortController()
    jobStatus.axiosCancel = controller
    const { next, ...jobInfoSend } = jobInfo
    const requestConfig: RequestConfig = {
      ...defaultRequestConfig,
      data: jobInfoSend,
      signal: controller.signal,
      url,
    }
    request(requestConfig)
      .then(({ data, status }) => {
        jobInfo.handleStatus = 1
        jobInfo.successDate = new Date()
        return {
          data,
          status,
        }
      })
      .catch((error) => {
        jobInfo.handleStatus = 2
        jobInfo.errDate = new Date()
        log.error('worker', jobInfo, (error && error.message) || error)
        return {
          error,
        }
      })
      .then((res) => {
        jobStatus.busy = 0
        jobInfo.busy = 0
        if (checkJob(jobInfo, jobStatus, session, job, '1')) {
          return
        }
        saveJob('task end', jobInfo, res)
      })
  })
  if (jobStatus.job) {
    jobInfo.next = jobStatus.job.nextInvocation()
    jobStatus.nextInvocation = jobInfo.next
    saveJob('task create', jobInfo)
  }
  else {
    log.error('worker', 'createJob 失败', jobInfo)
  }
}

/**
 * 开始任务
 * @param {*} key
 */
async function taskStart(key: string, flag: number) {
  const jobInfo = await getTask(key)

  const {
    delay = cfgSchedule.delay,
    delayCount = -1,
    delayMax = cfgSchedule.delayMax,
  } = jobInfo
  jobInfo.workerId = currentWorkerId
  jobInfo.firstDate = jobInfo.firstDate || new Date()
  jobInfo.updateDate = new Date()

  const jobStatus = jobStatuses[key] || ({} as WorkerTaskStatus)
  jobStatuses[key] = jobStatus

  if (flag === 1) {
    // 更新模式 且已执行调度
    createJob(jobInfo, jobStatus)
    return
  }

  if (
    flag === 2
    && (jobStatus.delayTimer
    || (jobStatus.job && new Date(jobStatus.nextInvocation) >= new Date()))
  ) {
    // 检测模式 调度任务在延迟阶段或调度时间有效状态
    return
  }

  if (!delay) {
    createJob(jobInfo, jobStatus)
    return
  }
  if (!jobStatus.job && delayCount < delayMax) {
    jobInfo.delayCount = delayCount + 1
    jobInfo.queueDate = jobInfo.queueDate
      ? new Date(jobInfo.queueDate)
      : new Date()
    const interval = Math.max(
      0,
      delay * 1000 - (new Date().getTime() - jobInfo.queueDate.getTime()),
    )
    if (jobStatus.delayTimer) {
      clearTimeout(jobStatus.delayTimer)
    }
    jobStatus.delayTimer = setTimeout(() => {
      createJob(jobInfo, jobStatus)
    }, interval)
    if (jobInfo.delayCount > 0) {
      log.debug('worker', 'task delay', jobInfo.key, jobInfo.name)
    }
  }
  else if (
    jobStatus.job
    && new Date(jobStatus.nextInvocation) >= new Date()
  ) {
    log.debug('worker', 'task ignore', jobInfo.key, jobInfo.name)
  }
  else {
    createJob(jobInfo, jobStatus)
  }
}
/**
 * 取消任务
 * @param {*} data
 */
async function jobCancel(key: string) {
  const jobCfg = jobStatuses[key]
  if (jobCfg) {
    if (jobCfg.job) {
      try {
        jobCfg.job.cancel()
      }
      catch (e) {
        log.error('worker', 'Cancel', jobCfg, e)
      }
    }
    if (jobCfg.axiosCancel) {
      try {
        jobCfg.axiosCancel.abort()
        jobCfg.axiosCancel = null
      }
      catch (e) {
        log.error('worker', 'Cancel', jobCfg, e)
      }
    }
    if (jobCfg.delayTimer) {
      clearTimeout(jobCfg.delayTimer)
    }
    delete jobStatuses[key]
  }
}

/**
 * 活跃
 */
function live() {
  redis.hset(rkWorkLive, currentWorkerId, new Date().getTime())
}

export default () => {
  log.info('worker', currentWorkerId)
  const pub = redisNew({})
  pub.subscribe(channelName)
  pub.on('message', (channel, message) => {
    if (channel !== channelName) {
      return
    }
    const { cmd, ext, id, key } = JSON.parse(message)
    if (currentWorkerId !== id) {
      return
    }
    if (cmd === 'start') {
      taskStart(key, ext)
    }
    else if (cmd === 'cancel') {
      jobCancel(key)
    }
  })
  live()
  setInterval(() => {
    live()
  }, 2000)
}
