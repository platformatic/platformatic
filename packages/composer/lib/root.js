import fastifyStatic from '@fastify/static'
import fastifyView from '@fastify/view'
import userAgentParser from 'my-ua-parser'
import { join } from 'node:path'
import nunjucks from 'nunjucks'

export default function root (app) {
  app.register(fastifyStatic, {
    root: join(import.meta.dirname, '../public')
  })
  app.register(fastifyView, {
    engine: {
      nunjucks
    },
    root: join(import.meta.dirname, '../public')
  })
  // root endpoint
  app.route({
    method: 'GET',
    path: '/',
    schema: { hide: true },
    handler: async (req, reply) => {
      const uaString = req.headers['user-agent']
      let hasOpenAPIServices = false
      let hasGraphQLServices = false
      if (uaString) {
        const parsed = userAgentParser(uaString)
        if (parsed.browser.name !== undefined) {
          const serviceTypes = {
            proxy: {
              title: 'Reverse Proxy',
              icon: './images/reverse-proxy.svg',
              services: []
            },
            openapi: {
              title: 'OpenAPI',
              icon: './images/openapi.svg',
              services: []
            },
            graphql: {
              title: 'GraphQL',
              icon: './images/graphql.svg',
              services: []
            }
          }

          app.platformatic.config.composer.services.forEach(s => {
            if (s.openapi) {
              hasOpenAPIServices = true
              serviceTypes.openapi.services.push(s)
            }
            if (s.graphql) {
              hasGraphQLServices = true
              serviceTypes.graphql.services.push(s)
            }
            if (s.proxy) {
              serviceTypes.proxy.services.push({
                ...s,
                externalLink: `${s.proxy.prefix}/`
              })
            }
          })

          return reply.view('index.njk', {
            hasGraphQLServices,
            hasOpenAPIServices,
            services: serviceTypes
          })
        }
      }
      // Load services
      return { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' }
    }
  })
}
