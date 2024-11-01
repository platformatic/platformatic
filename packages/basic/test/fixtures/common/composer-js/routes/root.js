module.export = async function (fastify) {
  fastify.get('/example', async () => {
    return { hello: fastify.example }
  })

  // This purposely overlaps with frontend so that we can test route merging
  fastify.get('$PREFIX/on-composer', async () => {
    return { ok: true }
  })
}
