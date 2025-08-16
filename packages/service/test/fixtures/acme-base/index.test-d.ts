import { expectType } from 'tsd'
import { AcmeBaseConfig, buildServer } from '.'
import { PlatformaticApplication } from '../../../index'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApplication<AcmeBaseConfig>
  }
}

async function main (): Promise<void> {
  const server = await buildServer({
    server: {
      port: 3042,
      hostname: '127.0.0.1'
    },
    dynamite: true
  })

  expectType<ConfigManager<AcmeBaseConfig>>(server.platformatic.configManager)
  expectType<AcmeBaseConfig>(server.platformatic.config)
}

main().catch(console.error)
