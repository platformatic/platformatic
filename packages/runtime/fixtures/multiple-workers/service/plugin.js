module.exports = async function (app) {
  app.get('/hello', async (request, reply) => {
    reply.header('x-plt-socket', request.socket.constructor.name)
    reply.header('x-plt-worker-id', globalThis.platformatic.worker)
    return { from: 'service' }
  })
}
