export default async function (fastify) {
  fastify.get('/example', async () => {
    return { ok: true }
  })
}
