import type { Project } from '~/types'

import { prjEdits } from '~/core'

export default eventHandler(async (event) => {
  const msg = await readBody<Record<string, Project>>(event)
  log.debug('/project/editall', msg)
  return prjEdits(msg)
})
