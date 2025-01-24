import { moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal } from 'node:assert'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { readFile } from 'fs/promises'

test('generate types with nullable properties', async (t) => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = desm.join(
    import.meta.url,
    'fixtures',
    'nullable-properties-openapi.json'
  )
  await execa('node', [
    desm.join(import.meta.url, '..', 'cli.mjs'),
    openAPIfile,
    '--name',
    'nullable-props',
    '--full-request',
    '--full-response',
  ])
  const typeFile = join(dir, 'nullable-props', 'nullable-props.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(
    data.includes(`
  export type GetSampleResponseOK = { 'rowDisplayOptions'?: Array<string> | null; 'columnDisplayOptions'?: Array<string>; 'entities'?: { 'id'?: string; 'name'?: string | null; 'operator'?: '=' | '!=' | null; 'value'?: 'toto' | 'tata' } | null }`),
    true
  )
})
