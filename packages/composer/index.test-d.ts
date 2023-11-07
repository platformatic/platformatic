import { buildServer, PlatformaticApp, PlatformaticComposerConfig } from '.'
import ConfigManager from '@platformatic/config'
import { expectType } from 'tsd'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticComposerConfig>
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

  expectType<ConfigManager<PlatformaticComposerConfig>>(server.platformatic.configManager)
}

main().catch(console.error)
