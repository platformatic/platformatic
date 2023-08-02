module.exports = async function (app, opts) {
  app.addHook('onRequest', async (req, reply) => {
    reply.send({ hello: 'from auto.hooks.js' })
  })
}
