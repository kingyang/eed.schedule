export default eventHandler(async (event) => {
  const { key, name, ...others } = await readBody<Record<string, string>>(
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
  console.debug(`${event.path} 模拟事务结束`)
  setResponseStatus(event, 204)
})
