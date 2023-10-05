import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'node:path'
import * as url from 'node:url'
import fs, { readFile, writeFile } from 'node:fs/promises'
import { buildServer } from '@platformatic/db'
import { request } from 'undici'
import { execa } from 'execa'
import { processFrontendOpenAPI } from '../lib/frontend-openapi-generator.mjs'
import { cliPath, moveToTmpdir } from './helper.js'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

test('build basic client from url', async (t) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'sample', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'sample', 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
  })
  await app.start()
  const res = await request(`${app.url}/documentation/json`)
  const schema = await res.body.json()
  const { types, implementation } = processFrontendOpenAPI({ schema, name: 'sample', language: 'js', fullResponse: false })

  // The types interfaces are being created
  assert.match(types, /interface FullResponse<T, U extends number>/)
  assert.match(types, /interface GetRedirectRequest/)
  assert.match(types, /interface GetRedirectResponseFound/)
  assert.match(types, /interface GetRedirectResponseBadRequest/)

  // handle non 200 code endpoint
  const expectedImplementation = `
async function _getRedirect (url, request) {
  const response = await fetch(\`\${url}/redirect?\${new URLSearchParams(Object.entries(request || {})).toString()}\`)

  let body = await response.text()

  try {
    body = JSON.parse(body)
  }
  catch (err) {
    // do nothing and keep original body
  }

  return {
    statusCode: response.status,
    headers: response.headers,
    body
  }
}

/**  @type {import('./sample-types.d.ts').Sample['getRedirect']} */
export const getRedirect = async (request) => {
  return await _getRedirect(baseUrl, request)
}`
  // create factory
  const factoryImplementation = `
export default function build (url) {
  return {
    getCustomSwagger: _getCustomSwagger.bind(url, ...arguments),
    getRedirect: _getRedirect.bind(url, ...arguments),
    getReturnUrl: _getReturnUrl.bind(url, ...arguments),
    postFoobar: _postFoobar.bind(url, ...arguments)
  }
}`
  // factory type
  const factoryType = `
type PlatformaticFrontendClient = Omit<Sample, 'setBaseUrl'>
export default function build(url: string): PlatformaticFrontendClient`

  // Correct CamelCase name
  const camelCase = 'export interface Sample {'
  assert.ok(implementation.includes(expectedImplementation))
  assert.ok(implementation.includes(factoryImplementation))
  assert.ok(types.includes(factoryType))
  assert.ok(types.includes(camelCase))

  {
    // Support custom url in cli
    const dir = await moveToTmpdir(t)
    await execa('node', [cliPath, `${app.url}/custom-swagger`, '--frontend', '--name', 'sample'])
    const implementation = await readFile(join(dir, 'sample', 'sample.mjs'), 'utf8')
    const types = await readFile(join(dir, 'sample', 'sample-types.d.ts'), 'utf8')

    const jsImplementationTemplate = `
/**  @type {import('./sample-types.d.ts').Sample['getCustomSwagger']} */
export const getCustomSwagger = async (request) => {
  return await _getCustomSwagger(baseUrl, request)
}`
    const typesTemplate = `
export interface Sample {
  setBaseUrl(newUrl: string) : void;
  getCustomSwagger(req?: GetCustomSwaggerRequest): Promise<GetCustomSwaggerResponses>;
  getRedirect(req?: GetRedirectRequest): Promise<GetRedirectResponses>;
  getReturnUrl(req?: GetReturnUrlRequest): Promise<GetReturnUrlResponses>;
  postFoobar(req?: PostFoobarRequest): Promise<PostFoobarResponses>;
}`

    const unionTypesTemplate = `type GetRedirectResponses = 
  FullResponse<GetRedirectResponseFound, 302>
  | FullResponse<GetRedirectResponseBadRequest, 400>
`
    assert.ok(implementation)
    assert.ok(types)
    assert.ok(implementation.includes(jsImplementationTemplate))
    assert.ok(types.includes(typesTemplate))
    assert.ok(types.includes(unionTypesTemplate))
  }
})

test('generate correct file names', async (t) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'sample', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'sample', 'platformatic.db.json'))

  t.after(async () => {
    await app.close()
  })

  await app.start()

  const dir = await moveToTmpdir(t)

  // Without --name will create api/client filenames
  await execa('node', [cliPath, app.url, '--language', 'ts', '--frontend'])
  assert.ok(await readFile(join(dir, 'api', 'api.ts')))
  assert.ok(await readFile(join(dir, 'api', 'api-types.d.ts')))

  await execa('node', [cliPath, app.url])
  assert.ok(await readFile(join(dir, 'client', 'client.cjs')))
  assert.ok(await readFile(join(dir, 'client', 'client.d.ts')))

  // With --name will create foobar.ts and foobar-types.d.ts
  await execa('node', [cliPath, app.url, '--language', 'ts', '--name', 'foobar', '--frontend'])
  assert.ok(await readFile(join(dir, 'foobar', 'foobar.ts')))
  assert.ok(await readFile(join(dir, 'foobar', 'foobar-types.d.ts')))

  // Without --name will create api.ts and api-types.d.ts
  await execa('node', [cliPath, app.url, '--language', 'ts', '--frontend'])
  assert.ok(await readFile(join(dir, 'api', 'api.ts')))
  assert.ok(await readFile(join(dir, 'api', 'api-types.d.ts')))

  // Convert dashes to camelCase
  await execa('node', [cliPath, app.url, '--language', 'ts', '--name', 'sample-name', '--frontend'])
  assert.ok(await readFile(join(dir, 'sample-name', 'sample-name.ts')))
  assert.ok(await readFile(join(dir, 'sample-name', 'sample-name-types.d.ts')))
})

test('test factory and client', async (t) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'sample', 'db.sqlite'))
  } catch {
    // noop
  }

  // start 2 services
  const app = await buildServer(join(__dirname, 'fixtures', 'sample', 'platformatic.db.json'))
  const app2 = await buildServer(join(__dirname, 'fixtures', 'sample', 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
    await app2.close()
  })

  await app.start()
  await app2.start()
  const dir = await moveToTmpdir(t)

  await execa('node', [cliPath, app.url, '--name', 'foobar', '--frontend'])
  const testFile = `
'use strict'

import build, { setBaseUrl, getReturnUrl } from './foobar.mjs'
const client = build('${app.url}')
setBaseUrl('${app2.url}')
console.log(await client.getReturnUrl({}))
console.log(await getReturnUrl({}))
`

  await writeFile(join(dir, 'foobar', 'test.mjs'), testFile)

  // execute the command
  const output = await execa('node', [join(dir, 'foobar', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n') // remove ANSI colors, if any
  /* eslint-enable no-control-regex */
  assert.equal(lines[0], `{ url: '${app.url}' }`) // client, app object
  assert.equal(lines[1], `{ url: '${app2.url}' }`) // raw, app2 object
})

test('generate frontend client from path', async (t) => {
  const dir = await moveToTmpdir(t)

  const fileName = join(__dirname, 'fixtures', 'frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend'])
  const implementation = await readFile(join(dir, 'api', 'api.ts'), 'utf8')
  const types = await readFile(join(dir, 'api', 'api-types.d.ts'), 'utf8')

  const tsImplementationTemplate = `
export const getHello: Api['getHello'] = async (request: Types.GetHelloRequest) => {
  return await _getHello(baseUrl, request)
}`
  const typesTemplate = `
export interface Api {
  setBaseUrl(newUrl: string) : void;
  getHello(req?: GetHelloRequest): Promise<GetHelloResponses>;
}`

  assert.ok(implementation)
  assert.ok(types)
  assert.ok(implementation.includes(tsImplementationTemplate))
  assert.ok(types.includes(typesTemplate))
})
