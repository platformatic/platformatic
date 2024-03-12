'use default'

/**  @type {import('fastify').FastifyPluginAsync<{ optionA: boolean, optionB: string }>} */
module.exports = async function (app) {
  const result = app.hello.get()
  app.get('/', async () => {
    return result
  })
}
