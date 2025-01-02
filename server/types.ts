import type { Canceler } from 'axios'
import type { Job } from 'node-schedule'

export interface TaskKey {
  /**
   * 任务唯一键值
   */
  key?: string
  /**
   *  键值源信息
   */
  keys?: any[]

  /**
   * 项目名称
   */
  name: string
}

/**
 *  任务信息
 */
export interface Task extends TaskKey {
  /**
   * 队列中延迟次数
   */
  delayCount?: number

  /**
   * 队列中初次加入时间
   */
  queueDate?: Date
}

export type Project = {
  /**
   * 任务并发量(默认10)
   */
  concurrency?: number
  /**
   * 调度配置
   * cron: '* * * * * *'
   * 见 https://www.npmjs.com/package/cron-parser
   */
  cron: string

  /**
   * 延迟时间
   */
  delay: number

  /**
   * 已延迟次数
   */
  delayCount?: number
  /**
   * 延迟次数
   */
  delayMax?: number
  /**
   * 0, 长期任务
   * 1, 短期任务
   * (默认值:1)
   */
  mode?: 0 | 1
  /**
   * 初次加入排队时间
   */
  queueDate?: Date
  /**
   * 任务状态
   * 0, 停止
   * 1, 运行
   * (默认值:1)
   */
  status?: number
  /**
   * 服务地址
   */
  url: string

} & Task

/**
 * 任务状态信息
 */
export type TaskInfo = {
  /**
   * 当前任务状态
   * 1 处理中
   */
  busy: 0 | 1
  /**
   * 最近异常状态
   */
  errDate: Date
  /**
   * 首次加入时间
   */
  firstDate: Date
  /**
   * 最近执行时间
   */
  handleDate: Date
  /**
   * 最近状态
   */
  handleStatus: number
  /**
   * 任务唯一键值
   */
  key: string
  /**
   * 下一次处理时间
   */
  next: Date
  /**
   * 排队时间
   */
  queueDate?: Date
  /**
   * 重试次数
   */
  round: number
  /**
   * 最近加入调度时间
   */
  scheduleDate: Date
  /**
   * 最近成功时间
   */
  successDate: Date
  /**
   * 任务更新(添加)时间
   */
  updateDate: Date
  /**
   * 工作区ID
   */
  workerId: string
} & Project

/**
 * 工作区任务状态
 */
export interface WorkerTaskStatus {
  axiosCancel: AbortController
  busy?: 0 | 1
  delayTimer?: NodeJS.Timeout
  job: Job
  nextInvocation: Date
  session: string
}
