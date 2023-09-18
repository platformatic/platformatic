import { buildServer, PlatformaticApp, PlatformaticDBMixin, PlatformaticDBConfig, Entities } from '.'
import ConfigManager from '@platformatic/config'
import type { Database } from '@platformatic/sql-mapper'
import { SQL } from '@databases/sql'
import { expectType } from 'tsd'
import { OpenAPI } from 'openapi-types'
import type { MercuriusPlugin } from 'mercurius'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticDBConfig> & PlatformaticDBMixin<Entities>
  }
}

async function main (): Promise<void> {
  // TODO this configuration is incomplete, type it fully
  const server = await buildServer({
    server: {
      port: 3042,
      host: '127.0.0.1'
    }
  })

  expectType<Database>(server.platformatic.db)
  expectType<SQL>(server.platformatic.sql)
  expectType<ConfigManager<PlatformaticDBConfig>>(server.platformatic.configManager)
  expectType<PlatformaticDBConfig>(server.platformatic.config)
  expectType<OpenAPI.Document>(server.swagger())
  expectType<MercuriusPlugin>(server.graphql)
}

main().catch(console.error)
