import { deepmerge } from '@platformatic/foundation'
import fp from 'fastify-plugin'

// For some unknown reason, c8 is not detecting any of this
// despite being covered by test/graphql.test.js
/* c8 ignore next 12 */
async function setupGraphQLPlugin (app, options) {
  if (typeof options !== 'object') {
    options = {}
  }

  const graphqlOptions = deepmerge(
    {
      graphiql: true,
      additionalRouteOptions: {
        schema: { hide: true }
      }
    },
    options
  )

  // The graphiql routes do not honor additionalRouteOptions:
  // hide them from the OpenAPI definition
  app.addHook('onRoute', routeOptions => {
    if (routeOptions.url === '/graphiql' || routeOptions.url.startsWith('/graphiql/')) {
      routeOptions.schema = { ...routeOptions.schema, hide: true }
    }
  })

  // Loaded on demand: mercurius and graphql are only needed when GraphQL is enabled
  const { default: mercurius } = await import('mercurius')
  app.register(mercurius, graphqlOptions)
}

export const setupGraphQL = fp(setupGraphQLPlugin)
