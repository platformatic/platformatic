import { expectType } from 'tsd'
import { FastifyInstance } from 'fastify'
import { buildServer } from '.'
import ConfigManager from '@platformatic/config'
import { OpenAPI } from 'openapi-types'
import type { MercuriusPlugin } from 'mercurius'
import { PlatformaticService } from './config'

const server = await buildServer({
})

expectType<FastifyInstance>(server)
expectType<ConfigManager<PlatformaticService>>(server.platformatic.configManager)
expectType<PlatformaticService>(server.platformatic.configManager.current)
expectType<PlatformaticService>(server.platformatic.config)
expectType<OpenAPI.Document>(server.swagger())
expectType<MercuriusPlugin>(server.graphql)
expectType<Promise<void>>(server.restart())
