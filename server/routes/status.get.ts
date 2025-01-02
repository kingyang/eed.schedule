import { getStatus } from '~/core'

export default eventHandler((event) => {
  return getStatus()
})
