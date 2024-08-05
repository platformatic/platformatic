const { join } = require('node:path')
const { readFileSync } = require('node:fs')
const fastify = require('fastify')
const fastifyAutoload = require('@fastify/autoload')
const fastifyRpc = require('../../../index.js')

const app = fastify()

const openapiSchemaPath = join(__dirname, 'openapi.json')
const openapiSchemaFile = readFileSync(openapiSchemaPath, 'utf8')
const openapiSchema = JSON.parse(openapiSchemaFile)
app.register(fastifyRpc, { openapi: openapiSchema })

app.register(fastifyAutoload, { dir: __dirname })

module.exports = app
