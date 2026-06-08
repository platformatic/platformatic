import { getMessaging } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: true })

  app.get('/thread/:id', async req => {
    const notify = req.query.notify
    const threadId = req.params.id

    let response = null
    if (notify) {
      const messaging = getMessaging()
      response = await messaging.notify('second', 'thread', { id: threadId })
    } else {
      const messaging = getMessaging()
      response = await messaging.send('second', 'thread', { request: threadId })
    }

    return { thread: response }
  })

  app.get('/crash', async () => {
    setImmediate(() => {
      throw new Error('kaboom')
    })

    return { hello: 'world' }
  })

  return app
}
