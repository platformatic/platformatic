import { cliPath } from './helper.mjs'
import { test } from 'tap'
import { join } from 'desm'
import { execa } from 'execa'
import { readFile, unlink } from 'fs/promises'

const GLOBAL_TYPES_TEMPLATE = `
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticServiceConfig } from '@platformatic/service'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticServiceConfig>
  }
}
`

test('generate global.d.ts', async ({ equal }) => {
  const fileNameOrThen = join(import.meta.url, '..', '..', 'fixtures', 'hello', 'global.d.ts')
  try {
    await unlink(fileNameOrThen)
  } catch {}

  await execa('node', [cliPath, 'types', '-c', join(import.meta.url, '..', '..', 'fixtures', 'hello', 'platformatic.service.json')])

  const data = await readFile(fileNameOrThen, 'utf-8')
  await unlink(fileNameOrThen)

  equal(data, GLOBAL_TYPES_TEMPLATE)
})
