import { abstractLogger, kMetadata } from '@platformatic/foundation'
import { printSchema as printGraphqlSchema } from 'graphql'
import { create } from '../../index.js'
import { resolveCommandConfiguration } from './configuration.js'

export async function printSchema (logger, configuration, args, context) {
  const { colorette: { bold }, logFatalError } = context
  const config = await resolveCommandConfiguration(configuration, context)

  const type = args[0]

  if (!type) {
    logFatalError(logger, `Please specify a schema type between ${bold('openapi')} and ${bold('graphql')}.`)
  } else if (type !== 'openapi' && type !== 'graphql') {
    logFatalError(logger, `Invalid schema type ${bold(type)}. Use ${bold('openapi')} or ${bold('graphql')}.`)
  }

  const app = await create(config[kMetadata].root, config, { logger: abstractLogger })
  await app.init()

  let output
  if (type === 'openapi') {
    await app.start({ listen: true })
    output = JSON.stringify(app.getApplication().swagger(), null, 2)
  } else {
    output = printGraphqlSchema(app.getApplication().graphql.schema)
  }

  console.log(output)
  await app.stop()
}
