import type { TaskKey } from '~/types'

import { getKey, taskCancel } from '~/core'

export default eventHandler(async (event) => {
  let msg = await readBody<TaskKey>(event)
  const key = getKey(msg)
  log.debug('/cancel', key, msg)
  msg = { ...msg, key }
  await taskCancel(msg, 1)
  setResponseStatus(event, 204)
})
