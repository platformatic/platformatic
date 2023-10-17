import { expectType } from 'tsd'
import { FastifyInstance } from 'fastify'
import { buildServer, PlatformaticApp, platformaticService, Stackable, PlatformaticServiceConfig } from '.'
import ConfigManager from '@platformatic/config'
import { OpenAPI } from 'openapi-types'
import type { MercuriusPlugin } from 'mercurius'
import { PlatformaticService } from './config'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticService>
  }
}

const server = await buildServer({
})

expectType<FastifyInstance>(server)
expectType<ConfigManager<PlatformaticService>>(server.platformatic.configManager)
expectType<PlatformaticService>(server.platformatic.configManager.current)
expectType<PlatformaticService>(server.platformatic.config)
expectType<OpenAPI.Document>(server.swagger())
expectType<MercuriusPlugin>(server.graphql)
expectType<Promise<void>>(server.restart())

function buildStackable (): Stackable<PlatformaticServiceConfig> {
  async function myApp (app: FastifyInstance, opts: object): Promise<void> {
    await platformaticService(app, opts)
  }

  myApp.schema = platformaticService.configManagerConfig.schema
  myApp.configType = 'myApp'
  myApp.configManagerConfig = {
    ...platformaticService.configManagerConfig,
    async transformConfig (this: ConfigManager<PlatformaticServiceConfig>) {
      this.current.plugins = {
        paths: [{
          path: 'my-plugin'
        }]
      }
    }
  }

  return myApp
}

expectType<Stackable<PlatformaticServiceConfig>>(buildStackable())
