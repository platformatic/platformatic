'use default'

/**  @type {import('fastify').FastifyPluginAsync<{ optionA: boolean, optionB: string }>} */
module.exports = async function (app) {
  const hasConfig = !!app.configureHello
  app.get('/', async (req) => {
    return { ...await req.hello.get(), hasConfig }
  })
}
