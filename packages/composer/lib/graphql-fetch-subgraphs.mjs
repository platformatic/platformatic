import pino from 'pino'
import pretty from 'pino-pretty'
import { buildClientSchema, printSchema } from 'graphql'
import { loadConfig } from '@platformatic/config'
import { compose as graphqlCompose } from '@platformatic/graphql-composer'

import { createSupergraph, serviceToSubgraphConfig } from './graphql-utils.js'
import { platformaticComposer } from '../index.js'

// TODO entities?
export async function fetchGraphqlSubgraphs (services) {
  const subgraphs = services.map(serviceToSubgraphConfig).filter(s => !!s)
  // TODO composer log
  const composer = await graphqlCompose({ subgraphs })
  const schema = buildClientSchema(composer.toSchema())

  // console.log('fetchGraphqlSubgraphs')
  // console.log(printSchema(schema))

  return createSupergraph({
    sdl: printSchema(schema),
    schema,
    resolvers: composer.resolvers
    // TODO subscription
  })
}

// TODO refactor with fetchOpenApiSchemasCli
export async function fetchGraphqlSubgraphsCli (argv) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid'
  }))

  try {
    const { configManager } = await loadConfig({}, argv, platformaticComposer)
    await configManager.parseAndValidate()
    const config = configManager.current

    const graphqlServices = config.composer.services
      .filter(({ graphql }) => !!graphql)

    await fetchGraphqlSubgraphs(graphqlServices)

    logger.info('Graphql subgraphs successfully fetched from services')
  } catch (err) {
    // TODO spy
    logger.error({ err }, 'Failed to fetch graphql subgraphs from services')
    process.exit(1)
  }
}
