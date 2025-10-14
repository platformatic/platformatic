export default async function (app) {
  app.get('/id', async () => {
    return { from: 'application-1' }
  })

  globalThis.platformatic.messaging.handle('id', () => 'application-1')

  app.get('/interceptor/application-2', async (_, reply) => {
    const res = await fetch('http://application-2.plt.local/id')
    reply.status(res.status)
    return res.json()
  })

  app.get('/interceptor/application-3', async (_, reply) => {
    const res = await fetch('http://application-3.plt.local/id')
    reply.status(res.status)
    return res.json()
  })

  app.get('/messaging/application-2', async () => {
    const from = await globalThis.platformatic.messaging.send('application-2', 'id')
    return { from }
  })

  app.get('/messaging/application-3', async (_, reply) => {
    const from = await globalThis.platformatic.messaging.send('application-3', 'id')
    return { from }
  })

  return app
}
