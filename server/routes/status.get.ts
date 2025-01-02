import { getStatus } from '~/core'

export default eventHandler(() => {
  return getStatus()
})
