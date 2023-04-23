module.exports = async function (app) {
  app.get('/page', async (req, reply) => {
    await req.authorize()
    return 'dummy'
  })

  app.post('/page', async (req, reply) => {
    await req.authorize()
    return 'dummy'
  })

  app.put('/page/:pageId', async (req, reply) => {
    await req.authorize()
    return 'dummy'
  })

  app.delete('/page/:pageId', async (req, reply) => {
    await req.authorize()
    return 'dummy'
  })
}
