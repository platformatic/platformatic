export default async function (fastify) {
  fastify.get('/hello', async () => {
    return { from: 'b' }
  })
}
