import { NestFactory } from '@nestjs/core'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { getAdditionalServerOptions } from '@platformatic/globals'
import { readFile } from 'node:fs/promises'
import { AppModule } from './app.module'

type HTTPSOptions = {
  key?: { path: string }
  cert?: { path: string }
}

async function bootstrap () {
  const options = (getAdditionalServerOptions({ throwOnMissing: false }) ?? {}) as HTTPSOptions
  const key = options.key
  const cert = options.cert
  const app = await NestFactory.create(
    AppModule,
    new FastifyAdapter(
      key && cert
        ? { https: { key: (await readFile(key.path)) as Buffer, cert: (await readFile(cert.path)) as Buffer } }
        : undefined
    )
  )

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
