import { moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal } from 'node:assert'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { readFile } from 'fs/promises'

test('export formdata on full request object', async (t) => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = desm.join(import.meta.url, 'fixtures', 'additional-properties-openapi.json')
  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openAPIfile, '--name', 'additional-props', '--full-request', '--full-response'])
  const typeFile = join(dir, 'additional-props', 'additional-props.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`
  export type GetSampleResponseOK = {
    'entities': { 'foo'?: { 'id'?: string; 'name'?: string }; 'bar'?: { 'type'?: 'boolean' | 'list'; 'values'?: Array<{ 'id': string; 'isArchived'?: boolean; 'isDefault': boolean; 'value': string }> }; 'baz'?: { 'id'?: string; 'name'?: string } };
    'errors': { 'types'?: { 'cause'?: unknown; 'type'?: 'notFound' | 'other' }; 'group': { 'cause'?: unknown; 'type'?: 'notFound' | 'other' } };
  }`), true)
})
