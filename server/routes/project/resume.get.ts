import { prjInit } from '~/core'

export default eventHandler((event) => {
  const { name } = getQuery(event)
  if (isEmpty(name)) {
    throw new Error('请输入任务名称')
  }
  log.debug('/project/resume', name)
  return prjInit(name as string, 1)
})
