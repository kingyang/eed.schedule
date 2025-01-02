export default eventHandler(async (event) => {
  const { key, keys, name, ...others } = await readBody<Record<string, string>>(
    event,
  )
  console.debug(`${event.path} ${name} ${key}`, others)

  // 模拟事务
  console.debug(`${event.path} 模拟事务`)
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve(1)
    }, 2000)
  })
  console.debug(event.node.req.originalUrl)
  // 若任务结束则嗲用cancel接口, 若未结束则可以不调用
  const cancelUrl = 'http://localhost:3000/cancel'
  console.debug('cancelUrl', cancelUrl)
  // TODO:验证信息
  await $fetch(cancelUrl, {
    body: { key, keys, name },
    method: 'POST',
  })
  console.debug(`${event.path} 模拟事务结束`)
  setResponseStatus(event, 204)
})
