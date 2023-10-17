import type { FastifyInstance } from "fastify"

export default async function (app: FastifyInstance) {
  app.log.info('Dynamite enabled')
  app.get('/dynamite', async () => {
    return 'Kaboom!'
  })
}
