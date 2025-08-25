export default async function (app) {
  app.get('/custom', async function (req, reply) {
    reply.send({ hello: 'world' })
  })
}
