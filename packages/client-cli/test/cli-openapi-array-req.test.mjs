import { isFileAccessible } from '../cli.mjs'
import { moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal } from 'node:assert'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'

const name = 'array-req'
test(`${name} with full option`, async () => {
  const openapi = desm.join(import.meta.url, 'fixtures', name, 'openapi.json')
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

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', name, '--full'])
  equal(await isFileAccessible(join(dir, name, `${name}.cjs`)), false)
  const typeFile = join(dir, name, `${name}.d.ts`)
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`export type ArrayReq = {
    /**
     * @param req - request parameters object
     * @returns the API response
     */
    putArrayReq(req: PutArrayReqRequest): Promise<FullResponse<unknown, 200>>;
  }
  export interface ArrayReqOptions {
    url: string
  }
  export const arrayReq: ArrayReqPlugin;
  export { arrayReq as default };
  export interface FullResponse<T, U extends number> {
    'statusCode': U;
    'headers': Record<string, string>;
    'body': T;
  }

  export type PutArrayReqRequest = {
    body: Array<string>
  }`), true)
})

test(`${name} without full option`, async () => {
  const openapi = desm.join(import.meta.url, 'fixtures', name, 'openapi.json')
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

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', name, '--full', 'false'])
  equal(await isFileAccessible(join(dir, name, `${name}.cjs`)), false)
  const typeFile = join(dir, name, `${name}.d.ts`)
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`export type ArrayReq = {
    /**
     * @param req - request parameters object
     * @returns the API response body
     */
    putArrayReq(req: PutArrayReqRequest): Promise<FullResponse<unknown, 200>>;
  }
  export interface ArrayReqOptions {
    url: string
  }
  export const arrayReq: ArrayReqPlugin;
  export { arrayReq as default };
  export interface FullResponse<T, U extends number> {
    'statusCode': U;
    'headers': Record<string, string>;
    'body': T;
  }

  export type PutArrayReqRequest = Array<string>`), true)
})
