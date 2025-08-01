import { execa } from 'execa'
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'
import { equal } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { isFileAccessible } from '../cli.mjs'
import { moveToTmpdir } from './helper.js'

test('empty-req-res', async () => {
  const openapi = join(import.meta.dirname, 'fixtures', 'empty-req-res', 'openapi.json')
  const dir = await moveToTmpdir(after)

  const pltServiceConfig = {
    $schema: 'https://schemas.platformatic.dev/@platformatic/service/1.52.0.json',
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    plugins: {
      paths: ['./plugin.js'],
    },
  }

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openapi, '--name', 'full', '--validate-response', '--optional-headers', 'headerId', '--full'])

  equal(await isFileAccessible(join(dir, 'full', 'full.cjs')), false)

  const typeFile = join(dir, 'full', 'full.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`
  export type GetHelloRequest = {
    
  }

  export type GetHelloResponseOK = unknown
  export type GetHelloResponses =
    FullResponse<GetHelloResponseOK, 200>`), true)
})
