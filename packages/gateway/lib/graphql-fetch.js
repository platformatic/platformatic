import { compose } from '@platformatic/graphql-composer'
import { buildSchema } from 'graphql'
import { readFile } from 'node:fs/promises'
import { CouldNotReadGraphQLSchemaFileError, InvalidGraphQLSchemaFileError } from './errors.js'

const placeholderSdl = 'Query { _info: String }'
const placeholderResolvers = { Query: { _info: '@platformatic/gateway' } }

// TODO support subscriptions
// const defaultSubscriptionsOptions = {
//   onError: function onGatewaySubscriptionsError (ctx, topic, err) {
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

function toGatewayOptions (options, app) {
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
  // in case of temporary failures of subgraphs on watching, the application can restart if no subgraphs are (tempoary) available
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

export function applicationToSubgraphConfig (application, sdl) {
  if (!application.graphql) {
    return
  }
  const subgraph = {
    name: application.graphql.name || application.id || application.origin,
    entities: application.graphql.entities,
    server: {
      host: application.graphql.host || application.origin,
      composeEndpoint: application.graphql.composeEndpoint,
      graphqlEndpoint: application.graphql.graphqlEndpoint
    }
  }
  if (sdl !== undefined) {
    subgraph.sdl = sdl
  }
  return subgraph
}

// A schema file is read once, on the first composition: the schema of the application is neither fetched
// from the application nor read again when the gateway polls the applications for changes.
const schemaFiles = new WeakMap()

async function readGraphqlSchemaFile (application) {
  const file = application.graphql?.file
  if (!file) {
    return
  }

  if (schemaFiles.has(application)) {
    return schemaFiles.get(application)
  }

  let sdl
  try {
    sdl = await readFile(file, 'utf8')
  } catch (err) {
    throw new CouldNotReadGraphQLSchemaFileError(file, application.id, err.message)
  }

  try {
    buildSchema(sdl)
  } catch (err) {
    throw new InvalidGraphQLSchemaFileError(file, application.id, err.message)
  }

  schemaFiles.set(application, sdl)
  return sdl
}

export async function fetchGraphqlSubgraphs (applications, options, app) {
  const subgraphs = []
  for (const application of applications) {
    const subgraph = applicationToSubgraphConfig(application, await readGraphqlSchemaFile(application))
    if (subgraph) {
      subgraphs.push(subgraph)
    }
  }

  const gateway = await compose({ ...toGatewayOptions(options, app), subgraphs })

  return createSupergraph({
    logger: app.log,
    sdl: gateway.toSdl(),
    resolvers: gateway.resolvers
  })
}
