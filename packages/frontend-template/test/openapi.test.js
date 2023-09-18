'use strict'

import { test } from 'tap'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import { processOpenAPI } from '../lib/gen-openapi.mjs'
import fs, { readFile, writeFile } from 'fs/promises'
import { request } from 'undici'
import * as url from 'url'
import { cliPath, moveToTmpdir } from './helper.js'
import { execa } from 'execa'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

test('build basic client from url', async ({ teardown, ok, match }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'sample', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'sample', 'platformatic.db.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()
  const res = await request(`${app.url}/documentation/json`)
  const schema = await res.body.json()
  const { types, implementation } = processOpenAPI({ schema, name: 'sample-frontend', url: app.url, language: 'js' })

  // The types interfaces are being created
  match(types, /interface FullResponse<T>/)
  match(types, /interface GetRedirectRequest/)
  match(types, /interface GetRedirectResponseFound/)
  match(types, /interface GetRedirectResponseBadRequest/)

  // handle non 200 code endpoint
  const expectedImplementation = `
async function _getRedirect (url, request) {
  const response = await fetch(\`\${url}/redirect?\${new URLSearchParams(Object.entries(request || {})).toString()}\`)

  let body = await response.text()

  try {
    body = JSON.parse(await response.json())
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

/**  @type {import('./api-types.d.ts').Api['getRedirect']} */
export const getRedirect = async (request) => {
  return await _getRedirect(baseUrl, request)
}`
  // create factory
  const factoryImplementation = `
export default function build (url) {
  return {
    getCustomSwagger: _getCustomSwagger.bind(url, ...arguments),
    getRedirect: _getRedirect.bind(url, ...arguments),
    getReturnUrl: _getReturnUrl.bind(url, ...arguments)
  }
}`
  // factory type
  const factoryType = `
type PlatformaticFrontendClient = Omit<Api, 'setBaseUrl'>
export default function build(url: string): PlatformaticFrontendClient`

  // Correct CamelCase name
  const camelCase = 'export interface SampleFrontend {'
  match(implementation, expectedImplementation)
  match(implementation, factoryImplementation)
  match(types, factoryType)
  match(types, camelCase)

  {
    // Support custom url in cli
    const dir = await moveToTmpdir(teardown)
    await execa('node', [cliPath, `${app.url}/custom-swagger`, 'js'])
    const implementation = await readFile(join(dir, 'api.js'), 'utf8')
    const types = await readFile(join(dir, 'api-types.d.ts'), 'utf8')

    const jsImplementationTemplate = `
/**  @type {import('./api-types.d.ts').Api['getCustomSwagger']} */
export const getCustomSwagger = async (request) => {
  return await _getCustomSwagger(baseUrl, request)
}`
    const typesTemplate = `
export interface Api {
  setBaseUrl(newUrl: string) : void;
  getCustomSwagger(req: GetCustomSwaggerRequest): Promise<GetCustomSwaggerResponseOK>;
  getRedirect(req: GetRedirectRequest): Promise<FullResponse<GetRedirectResponseFound> | FullResponse<GetRedirectResponseBadRequest>>;
  getReturnUrl(req: GetReturnUrlRequest): Promise<GetReturnUrlResponseOK>;
}`

    ok(implementation)
    ok(types)
    match(implementation, jsImplementationTemplate)
    match(types, typesTemplate)
  }
})

test('generate correct file names', async ({ teardown, ok }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'sample', 'db.sqlite'))
  } catch {
    // noop
  }
  const app = await buildServer(join(__dirname, 'fixtures', 'sample', 'platformatic.db.json'))

  teardown(async () => {
    await app.close()
  })

  await app.start()

  const dir = await moveToTmpdir(teardown)

  // With --name will create foobar.ts and foobar-types.d.ts
  await execa('node', [cliPath, app.url, 'ts', '--name', 'foobar'])
  ok(await readFile(join(dir, 'foobar.ts')))
  ok(await readFile(join(dir, 'foobar-types.d.ts')))

  // Without --name will create api.ts and api-types.d.ts
  await execa('node', [cliPath, app.url, 'ts'])
  ok(await readFile(join(dir, 'api.ts')))
  ok(await readFile(join(dir, 'api-types.d.ts')))

  // Convert dashes to camelCase
  await execa('node', [cliPath, app.url, 'ts', '--name', 'sample-name'])
  ok(await readFile(join(dir, 'sampleName.ts')))
  ok(await readFile(join(dir, 'sampleName-types.d.ts')))
})

test('test factory and client', async ({ teardown, equal }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'sample', 'db.sqlite'))
  } catch {
    // noop
  }

  // start 2 services
  const app = await buildServer(join(__dirname, 'fixtures', 'sample', 'platformatic.db.json'))
  const app2 = await buildServer(join(__dirname, 'fixtures', 'sample', 'platformatic.db.json'))
  teardown(async () => {
    await app.close()
    await app2.close()
  })

  await app.start()
  await app2.start()
  const dir = await moveToTmpdir(teardown)

  await execa('node', [cliPath, app.url, 'js', '--name', 'foobar'])
  const testFile = `
'use strict'

import build, { setBaseUrl, getReturnUrl } from './foobar.js'
const client = build('${app.url}')
setBaseUrl('${app2.url}')
console.log(await client.getReturnUrl({}))
console.log(await getReturnUrl({}))
`

  await writeFile(join(dir, 'test.js'), testFile)

  // execute the command
  const output = await execa('node', [join(dir, 'test.js')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n') // remove ANSI colors, if any
  /* eslint-enable no-control-regex */
  equal(lines[0], `{ url: '${app.url}' }`) // client, app object
  equal(lines[1], `{ url: '${app2.url}' }`) // raw, app2 object
})

test('generate frontend client from path', async ({ teardown, ok, match }) => {
  const dir = await moveToTmpdir(teardown)

  const fileName = join(__dirname, 'fixtures', 'openapi.json')
  await execa('node', [cliPath, fileName, 'ts'])
  const implementation = await readFile(join(dir, 'api.ts'), 'utf8')
  const types = await readFile(join(dir, 'api-types.d.ts'), 'utf8')

  const tsImplementationTemplate = `
export const getHello: Api['getHello'] = async (request: Types.GetHelloRequest) => {
  return await _getHello(baseUrl, request)
}`
  const typesTemplate = `
export interface Api {
  setBaseUrl(newUrl: string) : void;
  getHello(req: GetHelloRequest): Promise<GetHelloResponseOK>;
}`

  ok(implementation)
  ok(types)
  match(implementation, tsImplementationTemplate)
  match(types, typesTemplate)
})
