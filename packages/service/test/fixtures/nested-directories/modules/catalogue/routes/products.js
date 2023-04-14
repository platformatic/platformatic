export default async function (fastify, opts) {
  fastify.get('/products', async (request, reply) => {
    const data = [{ sku: 42, name: 'foo' }, { sku: 43, name: 'bar' }]
    // Currently slow and inefficient, but ok for the demo
    for (const product of data) {
      product.inStore = await fastify.inventory.howManyInStore(product.sku)
    }
    return data
  })

  fastify.get('/error', async (request, reply) => {
    throw new Error('This is an error')
  })
}
