import { compose } from '@platformatic/graphql-composer'

const placeholderSdl = 'Query { _info: String }'
const placeholderResolvers = { Query: { _info: '@platformatic/composer' } }

// TODO support subscriptions
// const defaultSubscriptionsOptions = {
//   onError: function onComposerSubscriptionsError (ctx, topic, err) {
//     // TODO log.error({err})
//     throw err
//   },
//   publish (ctx, topic, payload) {
//     ctx.pubsub.publish({ topic, payload })
//   },
//   subscribe (ctx, topic) {
//     return ctx.pubsub.subscribe(topic)
//   },
//   unsubscribe (ctx, topic) {
//     ctx.pubsub.close()
//   }
// }

function toComposerOptions (options, app) {
  return {
    logger: app.log,
    defaultArgsAdapter: options?.defaultArgsAdapter,
    addEntitiesResolvers: options?.addEntitiesResolvers,
    entities: options?.entities,
    onSubgraphError: (err, subgraphName) => {
      app.log.error({ err }, 'graphql composer error on subgraph ' + subgraphName)

      if (options?.onSubgraphError) {
        try {
          options.onSubgraphError(err, subgraphName)
        } catch (err) {
          app.log.error({ err }, 'running onSubgraphError')
        }
      }
    }
  }
}

export function createSupergraph ({ sdl = null, resolvers = {} } = {}) {
  // in case of temporary failures of subgraphs on watching, the service can restart if no subgraphs are (tempoary) available
  if (!sdl) {
    return {
      sdl: placeholderSdl,
      resolvers: placeholderResolvers
    }
  }
  return { sdl, resolvers }
}

export function isSameGraphqlSchema (a, b) {
  // TODO review
  return a?.sdl === b?.sdl
}

export function serviceToSubgraphConfig (service) {
  if (!service.graphql) {
    return
  }
  return {
    name: service.graphql.name || service.id || service.origin,
    entities: service.graphql.entities,
    server: {
      host: service.graphql.host || service.origin,
      composeEndpoint: service.graphql.composeEndpoint,
      graphqlEndpoint: service.graphql.graphqlEndpoint
    }
  }
}

export async function fetchGraphqlSubgraphs (services, options, app) {
  const subgraphs = services.map(serviceToSubgraphConfig).filter(s => !!s)
  const composer = await compose({ ...toComposerOptions(options, app), subgraphs })

  return createSupergraph({
    logger: app.log,
    sdl: composer.toSdl(),
    resolvers: composer.resolvers
  })
}
