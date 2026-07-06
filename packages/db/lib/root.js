import fastifyStatic from '@fastify/static'
import userAgentParser from 'my-ua-parser'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export async function root (app, config) {
  app.register(fastifyStatic, {
    root: path.join(import.meta.dirname, '../public')
  })

  const swaggerPrefix = config.db?.openapi?.swaggerPrefix
  let indexPage

  async function loadIndexPage () {
    if (!indexPage) {
      const html = await readFile(path.join(import.meta.dirname, '../public/index.html'), 'utf8')
      const openapiRoute = JSON.stringify(swaggerPrefix.replace(/^\/+/, ''))
      indexPage = html.replace('</head>', `<script>window.PLT_OPENAPI_ROUTE = ${openapiRoute}</script></head>`)
    }
    return indexPage
  }

  // root endpoint
  app.route({
    method: 'GET',
    path: '/',
    schema: { hide: true },
    handler: async (req, reply) => {
      const uaString = req.headers['user-agent']
      if (uaString) {
        const parsed = userAgentParser(uaString)
        if (parsed.browser.name !== undefined) {
          if (swaggerPrefix) {
            return reply.type('text/html').send(await loadIndexPage())
          }
          return reply.sendFile('./index.html')
        }
      }
      return { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' }
    }
  })
}
