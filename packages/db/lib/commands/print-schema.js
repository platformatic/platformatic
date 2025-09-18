import { abstractLogger, kMetadata, loadConfiguration } from '@platformatic/foundation'
import { printSchema as printGraphqlSchema } from 'graphql'
import { create } from '../../index.js'
import { schema } from '../schema.js'
import { transform } from '../config-transform.js'

export async function printSchema (logger, configFile, args, { colorette: { bold }, logFatalError }) {
  const config = await transform(await loadConfiguration(configFile, schema))

  const type = args[0]

  if (!type) {
    logFatalError(logger, `Please specify a schema type between ${bold('openapi')} and ${bold('graphql')}.`)
  } else if (type !== 'openapi' && type !== 'graphql') {
    logFatalError(logger, `Invalid schema type ${bold(type)}. Use ${bold('openapi')} or ${bold('graphql')}.`)
  }

  const app = await create(config[kMetadata].root, configFile, { logger: abstractLogger })
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
