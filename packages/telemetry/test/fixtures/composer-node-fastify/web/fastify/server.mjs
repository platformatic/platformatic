import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

export async function build () {
  const server = fastify({
    loggerInstance: getLogger()
  })

  let count = 0

  server.get('/', async (req, res) => {
    return { content: `from Fastify: ${count++}!` }
  })

  server.get('/node', async (req, res) => {
    const resp = await fetch("http://node.plt.local/")
    return { content: `from Fastify: ${count++}!` }
  })

  return server
}
