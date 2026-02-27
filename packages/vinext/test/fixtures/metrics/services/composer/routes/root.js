module.exports = async function (fastify) {
  fastify.get('/example', async () => {
    return { hello: fastify.example }
  })

  // This purposely overlaps with frontend so that we can test route merging
  fastify.get('/frontend/on-composer', async () => {
    return { ok: true }
  })
}
