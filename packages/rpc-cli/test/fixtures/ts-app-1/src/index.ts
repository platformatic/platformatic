import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import fastify from 'fastify'
import fastifyAutoload from '@fastify/autoload'
import fastifyRpc from '@platformatic/rpc'

async function main () {
  const app = fastify()

  const openapiSchemaPath = join(__dirname, 'openapi.json')
  const openapiSchemaFile = await readFile(openapiSchemaPath, 'utf8')
  const openapiSchema = JSON.parse(openapiSchemaFile)
  app.register(fastifyRpc, { openapi: openapiSchema })

  app.register(fastifyAutoload, { dir: __dirname })
  await app.listen({ port: 3042 })
}

main()
