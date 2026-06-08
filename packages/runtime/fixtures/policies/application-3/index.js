import { getMessaging } from '@platformatic/globals'
export default async function (app) {
  app.get('/id', async () => {
    return { from: 'application-3' }
  })

  const messaging = getMessaging()
  messaging.handle('id', () => 'application-3')

  app.get('/interceptor/application-1', async (_, reply) => {
    const res = await fetch('http://application-1.plt.local/id')
    reply.status(res.status)
    return res.json()
  })

  app.get('/interceptor/application-2', async (_, reply) => {
    const res = await fetch('http://application-2.plt.local/id')
    reply.status(res.status)
    return res.json()
  })

  app.get('/messaging/application-1', async () => {
    const messaging = getMessaging()
    const from = await messaging.send('application-1', 'id')
    return { from }
  })

  app.get('/messaging/application-2', async (_, reply) => {
    const messaging = getMessaging()
    const from = await messaging.send('application-2', 'id')
    return { from }
  })

  return app
}
