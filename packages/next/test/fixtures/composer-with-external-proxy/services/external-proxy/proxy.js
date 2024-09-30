'use strict'

module.exports = async function (fastify, opts) {
  fastify.register(require('@fastify/reply-from'), {
    base: 'http://composer.plt.local',
    globalAgent: true
  })

  fastify.get('/external-proxy/*', async (req, reply) => {
    const newUrl = req.raw.url.replace('/external-proxy', '')
    reply.from(newUrl.startsWith('/frontend') ? req.raw.url : newUrl)
    return reply
  })
}
