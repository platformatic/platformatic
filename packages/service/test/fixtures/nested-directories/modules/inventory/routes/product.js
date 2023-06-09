export default async function (fastify, opts) {
  fastify.get('/product/:sku', {
    schema: {
      params: {
        type: 'object',
        properties: {
          sku: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const sku = request.params.sku
    return { sku, inStore: await fastify.inventory.howManyInStore(sku) }
  })
}
