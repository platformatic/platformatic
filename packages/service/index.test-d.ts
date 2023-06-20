import { expectType } from 'tsd'
import { FastifyInstance } from 'fastify'
import { buildServer } from '.'
import ConfigManager from '@platformatic/config'
import { OpenAPI } from 'openapi-types'
import type { MercuriusPlugin } from 'mercurius'

const server = await buildServer({
})

expectType<FastifyInstance>(server)
expectType<ConfigManager>(server.platformatic.configManager)
expectType<ConfigManager>(server.platformatic.configManager)
expectType<OpenAPI.Document>(server.swagger())
expectType<MercuriusPlugin>(server.graphql)
expectType<Promise<void>>(server.restart())
