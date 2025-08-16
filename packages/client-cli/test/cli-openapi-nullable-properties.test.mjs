import { execa } from 'execa'
import { readFile } from 'fs/promises'
import { equal } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { moveToTmpdir } from './helper.js'

test('generate types with nullable properties', async t => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'nullable-properties-openapi.json')
  await execa('node', [
    join(import.meta.dirname, '..', 'cli.mjs'),
    openAPIfile,
    '--name',
    'nullable-props',
    '--full-request',
    '--full-response'
  ])
  const typeFile = join(dir, 'nullable-props', 'nullable-props.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(
    data.includes(`
export type GetSampleResponseOK = { 'rowDisplayOptions'?: Array<string> | null; 'columnDisplayOptions'?: Array<string>; 'entities'?: { 'id'?: string; 'name'?: string | null; 'operator'?: '=' | '!=' | null; 'value'?: 'toto' | 'tata' } | null }`),
    true
  )
})
