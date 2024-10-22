import { isFileAccessible } from '../cli.mjs'
import { moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal } from 'node:assert'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'

test('empty-req-res', async () => {
  const openapi = desm.join(import.meta.url, 'fixtures', 'empty-req-res', 'openapi.json')
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

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', 'full', '--validate-response', '--optional-headers', 'headerId', '--full'])

  equal(await isFileAccessible(join(dir, 'full', 'full.cjs')), false)

  const typeFile = join(dir, 'full', 'full.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`
  export type GetHelloRequest = {
    
  }

  export type GetHelloResponseOK = unknown`), true)
})
