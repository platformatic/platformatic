import fastify from 'fastify'

export async function build () {
  const server = fastify({
    loggerInstance: globalThis.platformatic?.logger
  })

  // Root endpoint that calls service-b
  server.get('/', async (req, res) => {
    const response = await fetch('http://service-b.plt.local/')
    const data = await response.json()

    return {
      service: 'service-a',
      downstream: data
    }
  })

  return server
}
