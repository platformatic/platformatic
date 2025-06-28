import { loadConfig } from '@platformatic/config'
import { writeFile } from 'fs/promises'
import graphql from 'graphql'
import pino from 'pino'
import pretty from 'pino-pretty'
import platformaticDB, { create } from '../index.js'
import { schema as platformaticDBschema } from './schema.js'

async function buildServer (_args, onServer) {
  const logger = pino(
    pretty({
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'hostname,pid',
      minimumLevel: 'error'
    })
  )

  try {
    const { configManager } = await loadConfig({}, _args, platformaticDB)
    const app = await create(process.cwd(), configManager.fullPath, {}, { logger })
    await app.start({ listen: true })
    await onServer(app.getApplication())
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

export { filenameConfigJsonSchema, generateJsonSchemaConfig, printGraphQLSchema, printOpenAPISchema }
