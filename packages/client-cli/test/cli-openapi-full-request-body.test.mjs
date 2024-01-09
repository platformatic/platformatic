import { isFileAccessible } from '../cli.mjs'
import { moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal } from 'node:assert'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'

test('full-request-body', async (t) => {
  const openapi = desm.join(import.meta.url, 'fixtures', 'full-req-body', 'openapi.json')
  const dir = await moveToTmpdir(after)
  t.diagnostic(`working in ${dir}`)

  const pltServiceConfig = {
    $schema: 'https://platformatic.dev/schemas/v0.28.0/service',
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    plugins: {
      paths: ['./plugin.js']
    }
  }

  await fs.writeFile('./platformatic.service.json', JSON.stringify(pltServiceConfig, null, 2))

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', 'full', '--validate-response', '--optional-headers', 'headerId', '--full'])

  equal(await isFileAccessible(join(dir, 'full', 'full.cjs')), false)

  const typeFile = join(dir, 'full', 'full.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  console.log('data', data)
  equal(data.includes(`
  export interface PostHelloRequest {
    body: {
      'mainData': Array<{ surname?: string; name: string }>;
    }
  }`), true)
})
