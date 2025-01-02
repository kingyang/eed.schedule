export default defineEventHandler((event) => {
  const { redis: options } = serverConfig
  if (!options.enable) {
    return sendError(
      event,
      createError({ statusCode: 500, statusMessage: 'redis not enable' }),
    )
  }

  const secrets = serverConfig.secrets
  if (!secrets || secrets.length === 0 || event.path.startsWith('/log') || event.path.startsWith('/test')) {
    return
  }

  const authorization
    = event.headers.get('authorization') || (getQuery(event).token as string)
  if (secrets.includes(authorization)) {
    event.context.user = authorization
  }
  else {
    return sendError(
      event,
      createError({ statusCode: 401, statusMessage: 'Unauthorized' }),
    )
  }
})
