import pino from 'pino'
import pretty from 'pino-pretty'
import Fastify from 'fastify'
import graphql from 'graphql'
import { writeFile } from 'fs/promises'
import loadConfig from './load-config.mjs'
import { createServerConfig } from '@platformatic/utils'
import { platformaticDB } from '../index.js'
import { schema as platformaticDBschema } from './schema.js'

async function buildServer (_args, onServer) {
  const logger = pino(pretty({
    translateTime: 'SYS:HH:MM:ss',
    ignore: 'hostname,pid',
    minimumLevel: 'error'
  }))

  try {
    const { configManager } = await loadConfig({}, _args, {})

    await configManager.parseAndValidate()
    const config = configManager.current
    config.logger = logger

    const serverConfig = createServerConfig(config)
    serverConfig.originalConfig = config
    serverConfig.configManager = configManager

    const app = Fastify(serverConfig)
    app.register(platformaticDB, serverConfig)

    await app.ready()

    await onServer(app)
    /* c8 ignore next 4 */
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

function printGraphQLSchema (_args) {
  buildServer(_args, async function (app) {
    const schema = graphql.printSchema(app.graphql.schema)
    console.log(schema)
    await app.close()
  })
}

function printOpenAPISchema (_args) {
  buildServer(_args, async function (app) {
    const schema = app.swagger()
    console.log(JSON.stringify(schema, null, 2))
    await app.close()
  })
}

const filenameConfigJsonSchema = 'platformatic.db.schema.json'

async function generateJsonSchemaConfig () {
  await writeFile(filenameConfigJsonSchema, JSON.stringify(platformaticDBschema, null, 2))
}

export { printGraphQLSchema, printOpenAPISchema, generateJsonSchemaConfig, filenameConfigJsonSchema }
