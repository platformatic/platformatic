import fastify from 'fastify'

const app = fastify()

app.get('/preload', async () => {
  return { value: globalThis.value }
})

app.get('/node-options', async () => {
  return { pid: process.pid, value: process.env.NODE_OPTIONS }
})

app.listen({ port: 0 })
