import type { Project } from '~/types'

import { prjCronTest } from '~/core'

export default eventHandler(async (event) => {
  const msg = await readBody(event)
  log.debug('/project/test', msg)
  const { count } = getQuery(event)
  return prjCronTest((msg || {}) as Project, count as string)
})
