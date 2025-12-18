import fastify from 'fastify'

export async function build () {
  const server = fastify({
    loggerInstance: globalThis.platformatic?.logger
  })

  // Root endpoint that calls service-c
  server.get('/', async (req, res) => {
    const response = await fetch('http://service-c.plt.local/')
    const data = await response.json()

    return {
      service: 'service-b',
      downstream: data
    }
  })

  return server
}
