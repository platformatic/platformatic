module.exports = async function (app) {
  const { getWorkerId } = require('@platformatic/globals')

  app.get('/hello', async (request, reply) => {
    reply.header('x-plt-port', app.server.address()?.port)
    reply.header('x-plt-socket', request.socket.constructor.name)
    reply.header('x-plt-worker-id', getWorkerId())
    return { from: 'service' }
  })
}
