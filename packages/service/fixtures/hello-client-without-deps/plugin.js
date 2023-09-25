'use default'

/**  @type {import('fastify').FastifyPluginAsync<{ optionA: boolean, optionB: string }>} */
module.exports = async function (app) {
  app.get('/', async (req) => {
    return req.hello.get()
  })
}
