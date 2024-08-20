import fastify from 'fastify'

export function build () {
  const app = fastify()

  app.get('/direct', async () => {
    return { ok: true }
  })

  app.get('/internal', () => {
    return fetch('http://main.plt.local/direct').then(response => response.json())
  })

  return app
}
