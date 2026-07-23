export default async function (fastify) {
  fastify.get('/hello', async () => ({ ok: true }))
}
