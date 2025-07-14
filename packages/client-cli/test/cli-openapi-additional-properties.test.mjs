import { execa } from 'execa'
import { readFile } from 'fs/promises'
import { equal } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { moveToTmpdir } from './helper.js'

test('export formdata on full request object', async (t) => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(import.meta.dirname, 'fixtures', 'additional-properties-openapi.json')
  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'additional-props', '--full-request', '--full-response'])
  const typeFile = join(dir, 'additional-props', 'additional-props.d.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`
  export type GetSampleResponseOK = { 'entities': { 'foo'?: Record<string, { 'id': string; 'name': string }>; 'bar'?: Record<string, { 'type': 'boolean' | 'list'; 'values': Array<{ 'id': string; 'isArchived'?: boolean; 'isDefault': boolean; 'value': string }> }>; 'baz'?: Record<string, { 'id': string; 'name': string }> }; 'errors': { 'types'?: Record<string, { 'cause'?: unknown; 'type': 'notFound' | 'other' }>; 'group': Record<string, { 'cause'?: unknown; 'type': 'notFound' | 'other' }> }; 'xyz'?: Record<string, number>; 'fantozzi'?: { 'carlo'?: string; 'martello'?: number; [key: string]: unknown } }`), true)

  equal(data.includes(`
  export type GetAnotherResponseOK = Record<string, { 'description': string }>`), true)
})
