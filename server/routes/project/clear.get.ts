import { prjClear } from '~/core'

export default eventHandler((event) => {
  const { name } = getQuery(event)
  if (isEmpty(name)) {
    throw new Error('请输入任务名称')
  }
  log.debug('/project/clear', name)
  return prjClear(name as string)
})
