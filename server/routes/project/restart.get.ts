import { prjInit } from '~/core'

export default eventHandler((event) => {
  const { name } = getQuery(event)
  if (isEmpty(name)) {
    throw new Error('请输入任务名称')
  }
  log.debug('/project/restart', name)
  return prjInit(name as string)
})
