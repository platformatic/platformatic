import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/hello', async () => {
    return { from: 'application-1' }
  })

  app.get('/from-application-2', async () => {
    const res = await fetch('http://application-2.plt.local/hello')
    return res.json()
  })

  app.get('/stress', () => {
    const interval = setInterval(() => {
      for (let i = 0; i < 1e7; i++) {
        Math.sqrt(Math.random())
      }
    }, 10)

    setTimeout(() => {
      clearInterval(interval)
    }, 10000)

    return { ok: true }
  })

  return app
}
