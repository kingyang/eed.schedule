import { checker, interval } from '~/core'
import worker from '~/worker'

export default defineNitroPlugin((nitroApp) => {
  log.debug('worker start')
  setInterval(checker, interval)
  checker()
  worker()
})
