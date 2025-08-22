import fastifyStatic from '@fastify/static'
import userAgentParser from 'my-ua-parser'
import path from 'node:path'

export async function root (app) {
  app.register(fastifyStatic, {
    root: path.join(import.meta.dirname, '../public')
  })
  // root endpoint
  app.route({
    method: 'GET',
    path: '/',
    schema: { hide: true },
    handler: (req, reply) => {
      const uaString = req.headers['user-agent']
      if (uaString) {
        const parsed = userAgentParser(uaString)
        if (parsed.browser.name !== undefined) {
          return reply.sendFile('./index.html')
        }
      }
      return { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' }
    }
  })
}
