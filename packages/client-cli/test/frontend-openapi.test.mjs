'use strict'

import { test } from 'tap'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import { processFrontendOpenAPI } from '../lib/frontend-openapi-generator.mjs'
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
  const { types, implementation } = processFrontendOpenAPI({ schema, name: 'sample', language: 'js', fullResponse: false })

  // The types interfaces are being created
  match(types, /interface FullResponse<T, U extends number>/)
  match(types, /type GetRedirectRequest =/)
  match(types, /type GetRedirectResponseFound =/)
  match(types, /type GetRedirectResponseBadRequest =/)
  match(types, /'message': string | null;/)

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
  match(implementation, expectedImplementation)
  match(implementation, factoryImplementation)
  match(types, factoryType)
  match(types, camelCase)

  {
    // Support custom url in cli
    const dir = await moveToTmpdir(teardown)
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
    ok(implementation)
    ok(types)
    match(implementation, jsImplementationTemplate)
    match(types, typesTemplate)
    match(types, unionTypesTemplate)
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

  // Without --name will create api/client filenames
  await execa('node', [cliPath, app.url, '--language', 'ts', '--frontend'])
  ok(await readFile(join(dir, 'api', 'api.ts')))
  ok(await readFile(join(dir, 'api', 'api-types.d.ts')))

  await execa('node', [cliPath, app.url])
  ok(await readFile(join(dir, 'client', 'client.cjs')))
  ok(await readFile(join(dir, 'client', 'client.d.ts')))

  // With --name will create foobar.ts and foobar-types.d.ts
  await execa('node', [cliPath, app.url, '--language', 'ts', '--name', 'foobar', '--frontend'])
  ok(await readFile(join(dir, 'foobar', 'foobar.ts')))
  ok(await readFile(join(dir, 'foobar', 'foobar-types.d.ts')))

  // Without --name will create api.ts and api-types.d.ts
  await execa('node', [cliPath, app.url, '--language', 'ts', '--frontend'])
  ok(await readFile(join(dir, 'api', 'api.ts')))
  ok(await readFile(join(dir, 'api', 'api-types.d.ts')))

  // Convert dashes to camelCase
  await execa('node', [cliPath, app.url, '--language', 'ts', '--name', 'sample-name', '--frontend'])
  ok(await readFile(join(dir, 'sample-name', 'sample-name.ts')))
  ok(await readFile(join(dir, 'sample-name', 'sample-name-types.d.ts')))
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
  equal(lines[0], `{ url: '${app.url}' }`) // client, app object
  equal(lines[1], `{ url: '${app2.url}' }`) // raw, app2 object
})

test('generate frontend client from path', async ({ teardown, ok, match }) => {
  const dir = await moveToTmpdir(teardown)

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

  ok(implementation)
  ok(types)
  match(implementation, tsImplementationTemplate)
  match(types, typesTemplate)
})

test('generate frontend client from path (name with dashes)', async ({ teardown, ok, match }) => {
  const dir = await moveToTmpdir(teardown)

  const fileName = join(__dirname, 'fixtures', 'frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'a-custom-name'])
  const implementation = await readFile(join(dir, 'a-custom-name', 'a-custom-name.ts'), 'utf8')
  const types = await readFile(join(dir, 'a-custom-name', 'a-custom-name-types.d.ts'), 'utf8')

  const importTemplate = `import type { ACustomName } from './a-custom-name-types'
import type * as Types from './a-custom-name-types'
`
  const tsImplementationTemplate = `
export const getHello: ACustomName['getHello'] = async (request: Types.GetHelloRequest) => {
  return await _getHello(baseUrl, request)
}`
  const typesTemplate = `
export interface ACustomName {
  setBaseUrl(newUrl: string) : void;
  getHello(req?: GetHelloRequest): Promise<GetHelloResponses>;
}`

  ok(implementation)
  ok(types)
  match(implementation, tsImplementationTemplate)
  match(types, typesTemplate)
  match(implementation, importTemplate)
})

test('append query parameters to url in non-GET requests', async ({ teardown, ok, match }) => {
  const dir = await moveToTmpdir(teardown)

  const fileName = join(__dirname, 'fixtures', 'append-query-params-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `
const _postRoot = async (url: string, request: Types.PostRootRequest) => {
  const queryParameters: (keyof Types.PostRootRequest)[] = ['level']
  const searchParams = new URLSearchParams()
  queryParameters.forEach((qp) =>{
    if (request[qp]) {
      searchParams.append(qp, request[qp]?.toString() || '')
      delete request[qp]
    }
  })

  const response = await fetch(\`\${url}/?\${searchParams.toString()}\`, {
`
  ok(implementation)
  match(implementation, tsImplementationTemplate)
})

test('handle headers parameters', async ({ teardown, ok, match }) => {
  const dir = await moveToTmpdir(teardown)

  const fileName = join(__dirname, 'fixtures', 'headers-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `
const _postRoot = async (url: string, request: Types.PostRootRequest) => {
  const response = await fetch(\`\${url}/\`, {
    method: 'POST',
    body: JSON.stringify(request),
    headers: {
      'Content-type': 'application/json',
      'level': request['level'],
      'foo': request['foo']
    }
  })
`
  ok(implementation)
  match(implementation, tsImplementationTemplate)
})

test('handle headers parameters in get request', async ({ teardown, ok, match }) => {
  const dir = await moveToTmpdir(teardown)

  const fileName = join(__dirname, 'fixtures', 'get-headers-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `
const _getRoot = async (url: string, request: Types.GetRootRequest) => {
  const response = await fetch(\`\${url}/?\${new URLSearchParams(Object.entries(request || {})).toString()}\`, {
    headers: {
      'level': request['level'],
      'foo': request['foo']
    }
  })
`
  ok(implementation)
  match(implementation, tsImplementationTemplate)
})
