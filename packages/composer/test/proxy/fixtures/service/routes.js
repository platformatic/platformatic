export default async function (app) {
  app.get('/hello', async () => {
    return { ok: true }
  })

  app.get('/id', async () => {
    return { from: 'service' }
  })

  app.post('/echo', async req => {
    return req.body
  })

  app.get('/redirect', (req, reply) => {
    reply.redirect('/hello')
  })
}
