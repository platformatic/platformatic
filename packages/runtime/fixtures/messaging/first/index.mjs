import { getMessaging } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: true })

  let workersChanges = 0
  getMessaging().onWorkersChange(() => {
    workersChanges++
  })

  app.get('/affinity/:key', async req => {
    const messaging = getMessaging()
    const owner = messaging.getWorkerForAffinity('second', req.params.key)
    const thread = await messaging.send('second', 'thread', {}, { affinity: req.params.key })

    return { thread, owner: `T${owner.thread}` }
  })

  app.get('/workers', async () => {
    return {
      ids: getMessaging()
        .getWorkers('second')
        .map(worker => worker.id),
      changes: workersChanges
    }
  })

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
