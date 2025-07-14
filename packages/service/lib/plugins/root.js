import fastifyStatic from '@fastify/static'
import fp from 'fastify-plugin'
import userAgentParser from 'my-ua-parser'
import { join } from 'node:path'

async function setupRootPlugin (app) {
  app.register(fastifyStatic, {
    root: join(import.meta.dirname, '../../public')
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

export const setupRoot = fp(setupRootPlugin)
