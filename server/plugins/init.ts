import { checker, interval } from '~/core'
import worker from '~/worker'

export default defineNitroPlugin(() => {
  const { redis: options } = serverConfig
  if (!options.enable) {
    log.debug('worker error:', 'redis not enable')
    return
  }
  log.debug('worker start')
  setInterval(checker, interval)
  checker()
  worker()
})
