import { getKey, taskStart } from '~/core'

export default eventHandler(async (event) => {
  const msg = await readBody(event)
  const key = getKey(msg)
  log.debug('/add', key, msg)
  await taskStart({ ...msg, key })
  setResponseStatus(event, 204)
})
