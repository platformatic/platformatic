export default async function (app) {
  app.get('/id', async () => {
    return { from: 'application-2' }
  })

  globalThis.platformatic.messaging.handle('id', () => 'application-2')

  app.get('/interceptor/application-1', async (_, reply) => {
    const res = await fetch('http://application-1.plt.local/id')
    reply.status(res.status)
    return res.json()
  })

  app.get('/interceptor/application-3', async (_, reply) => {
    const res = await fetch('http://application-3.plt.local/id')
    reply.status(res.status)
    return res.json()
  })

  app.get('/messaging/application-1', async () => {
    const from = await globalThis.platformatic.messaging.send('application-1', 'id')
    return { from }
  })

  app.get('/messaging/application-3', async (_, reply) => {
    const from = await globalThis.platformatic.messaging.send('application-3', 'id')
    return { from }
  })

  return app
}
