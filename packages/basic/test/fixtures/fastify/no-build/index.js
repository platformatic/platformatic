import fastify from 'fastify'

const app = fastify()

app.get('/direct', async () => {
  return { ok: true }
})

app.get('/internal', () => {
  return fetch('http://main.plt.local/direct').then(response => response.json())
})

// This would likely fail if our code doesn't work
app.listen({ port: 1 })
