import type { Project } from '~/types'

import { prjEdit } from '~/core'

export default eventHandler(async (event) => {
  const msg = await readBody<Project>(event)
  log.debug('/project/edit', msg)
  return prjEdit(msg)
})
