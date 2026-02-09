/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  app.get('/data', async () => {
    return { message: 'hello from backend' }
  })
}
