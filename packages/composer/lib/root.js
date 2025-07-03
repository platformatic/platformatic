'use strict'

const { join } = require('node:path')
const fastifyStatic = require('@fastify/static')
const userAgentParser = require('my-ua-parser')

module.exports = async (app, opts) => {
  app.register(fastifyStatic, {
    root: join(__dirname, '../public')
  })
  app.register(require('@fastify/view'), {
    engine: {
      nunjucks: require('nunjucks')
    },
    root: join(__dirname, '../public')
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
