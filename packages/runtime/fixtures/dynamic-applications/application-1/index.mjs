import sleep from 'atomic-sleep'
import fastify from 'fastify'

export function create () {
  const app = fastify()
  let interval = null

  app.addHook('onClose', async () => {
    clearInterval(interval)
  })

  app.get('/hello', async () => {
    return { from: 'application-1' }
  })

  app.get('/from-application-2', async () => {
    const res = await fetch('http://application-2.plt.local/hello')
    return res.json()
  })

  app.get('/stress', () => {
    interval = setInterval(() => {
      sleep(900)
    }, 1000)

    return { ok: true }
  })

  return app
}
