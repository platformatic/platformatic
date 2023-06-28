'use default'

/**  @type {import('fastify').FastifyPluginAsync<{ optionA: boolean, optionB: string }>} */
module.exports = async function (app) {
  app.get('/', async () => {
    return app.hello.get()
  })
}
