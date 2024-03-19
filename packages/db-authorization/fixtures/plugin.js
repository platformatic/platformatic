'use strict'

module.exports = async function (app) {
  app.get('/page', async (req, reply) => {
    await req.authorize()
    return { title: 'hello' }
  })

  app.post('/page', async (req, reply) => {
    await req.authorize()
    reply.code(201)
  })

  app.put('/page/:pageId', async (req, reply) => {
    await req.authorize()
  })

  app.delete('/page/:pageId', async (req, reply) => {
    await req.authorize()
  })
}
