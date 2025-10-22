import sleep from 'atomic-sleep'
import fastify from 'fastify'

export function create () {
  const app = fastify()
  let interval

  app.addHook('onClose', async () => {
    clearInterval(interval)
  })

  app.get('/hello', async () => {
    return { from: 'application-2' }
  })

  app.get('/from-application-1', async () => {
    const res = await fetch('http://application-1.plt.local/hello')
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
