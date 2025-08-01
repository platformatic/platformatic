'use strict'

import { test, after, mock } from 'node:test'
import { equal, ok, match } from 'node:assert'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import { processFrontendOpenAPI } from '../lib/frontend-openapi-generator.mjs'
import fs, { readFile, writeFile } from 'fs/promises'
import { request } from 'undici'
import * as url from 'url'
import { cliPath, moveToTmpdir } from './helper.js'
import { execa } from 'execa'

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
  const warn = mock.fn()
  const logger = { warn }
  const { types, implementation } = processFrontendOpenAPI({ schema, name: 'sample', language: 'js', fullResponse: false, fullRequest: false, logger })

  // Warning log has been triggered
  ok(warn.mock.callCount() > 0)

  // The types interfaces are being created
  match(types, /interface FullResponse<T, U extends number>/)
  match(types, /type GetRedirectRequest = /)
  match(types, /type GetRedirectResponseFound = /)
  match(types, /type GetRedirectResponseBadRequest = /)

  // Request can contain a `Date` type
  ok(types.includes("'messageReq': string | null;"))
  ok(types.includes("'dateTimeReq': string | Date;"))
  ok(types.includes("'otherDateReq': string | Date;"))
  ok(types.includes("'nullableDateReq': string | Date | null;"))
  ok(types.includes("'normalStringReq': string;"))

  // Response shouldn't contain `Date` for the same fields as above
  ok(types.includes("'messageRes'?: string | null;"))
  ok(types.includes("'dateTimeRes'?: string;"))
  ok(types.includes("'otherDateRes'?: string;"))
  ok(types.includes("'nullableDateRes'?: string | null;"))
  ok(types.includes("'normalStringRes'?: string"))

  // handle non 200 code endpoint
  const expectedImplementation = `
async function _getRedirect (url, request) {
  const headers = {
    ...defaultHeaders
  }

  const response = await fetch(\`\${url}/redirect\`, {
    headers,
    ...defaultFetchParams
  })

  const jsonResponses = [302, 400]
  if (jsonResponses.includes(response.status)) {
    return {
      statusCode: response.status,
      headers: headersToJSON(response.headers),
      body: await response.json()
    }
  }
  const responseType = response.headers.get('content-type')?.startsWith('application/json') ? 'json' : 'text'
  return {
    statusCode: response.status,
    headers: headersToJSON(response.headers),
    body: await response[responseType]()
  }
}

/**  @type {import('./sample-types.d.ts').Sample['getRedirect']} */
export const getRedirect = async (request) => {
  return await _getRedirect(baseUrl, request)
}`
  // create factory
  const factoryImplementation = `
export default function build (url, options) {
  url = sanitizeUrl(url)
  if (options?.headers) {
    defaultHeaders = options.headers
  }
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
type BuildOptions = {
  headers?: object
}
export default function build(url: string, options?: BuildOptions): PlatformaticFrontendClient`

  // Correct CamelCase name
  const camelCase = 'export interface Sample {'
  equal(implementation.includes(expectedImplementation), true)
  equal(implementation.includes(factoryImplementation), true)
  equal(types.includes(factoryType), true)
  equal(types.includes(camelCase), true)

  {
    // Support custom url in cli
    const dir = await moveToTmpdir(after)
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
  setBaseUrl(newUrl: string): void;
  setDefaultHeaders(headers: object): void;
  setDefaultFetchParams(fetchParams: RequestInit): void;
  /**
   * @param req - request parameters object
   * @returns the API response
   */
  getCustomSwagger(req: GetCustomSwaggerRequest): Promise<GetCustomSwaggerResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response
   */
  getRedirect(req: GetRedirectRequest): Promise<GetRedirectResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response
   */
  getReturnUrl(req: GetReturnUrlRequest): Promise<GetReturnUrlResponses>;
  /**
   * @param req - request parameters object
   * @returns the API response
   */
  postFoobar(req: PostFoobarRequest): Promise<PostFoobarResponses>;
}`

    const unionTypesTemplate = `export type GetRedirectResponses =
  FullResponse<GetRedirectResponseFound, 302>
  | FullResponse<GetRedirectResponseBadRequest, 400>`
    const postFooBarResponses = `export type PostFoobarResponseOK = unknown
export type PostFoobarResponses =
  FullResponse<PostFoobarResponseOK, 200>`
    ok(implementation)
    ok(types)
    equal(implementation.includes(jsImplementationTemplate), true)
    equal(types.includes(typesTemplate), true)
    equal(types.includes(unionTypesTemplate), true)
    equal(types.includes(postFooBarResponses), true)
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

  const dir = await moveToTmpdir(after)

  // Without --name will create api/client filenames
  await execa('node', [cliPath, app.url, '--language', 'ts', '--frontend'])
  ok(await readFile(join(dir, 'api', 'api.ts'), 'utf-8'))
  ok(await readFile(join(dir, 'api', 'api-types.d.ts'), 'utf-8'))

  await execa('node', [cliPath, app.url])
  ok(await readFile(join(dir, 'client', 'client.cjs'), 'utf-8'))
  ok(await readFile(join(dir, 'client', 'client.d.ts'), 'utf-8'))

  // With --name will create foobar.ts and foobar-types.d.ts
  await execa('node', [cliPath, app.url, '--language', 'ts', '--name', 'foobar', '--frontend'])
  ok(await readFile(join(dir, 'foobar', 'foobar.ts'), 'utf-8'))
  ok(await readFile(join(dir, 'foobar', 'foobar-types.d.ts'), 'utf-8'))

  // Without --name will create api.ts and api-types.d.ts
  await execa('node', [cliPath, app.url, '--language', 'ts', '--frontend'])
  ok(await readFile(join(dir, 'api', 'api.ts'), 'utf-8'))
  ok(await readFile(join(dir, 'api', 'api-types.d.ts'), 'utf-8'))

  // Convert dashes to camelCase
  await execa('node', [cliPath, app.url, '--language', 'ts', '--name', 'sample-name', '--frontend'])
  ok(await readFile(join(dir, 'sample-name', 'sample-name.ts'), 'utf-8'))
  ok(await readFile(join(dir, 'sample-name', 'sample-name-types.d.ts'), 'utf-8'))
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
  const dir = await moveToTmpdir(after)

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
  let foundAppUrl = false
  lines.forEach((line) => {
    if (line.trim().startsWith('body')) {
      if (!foundAppUrl) {
        ok(line.trim().endsWith(`'{"url":"${app.url}"}'`))
        foundAppUrl = true
      } else {
        ok(line.trim().endsWith(`'{"url":"${app2.url}"}'`))
      }
    }
  })
})

test('generate frontend client from path', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend'])
  const implementation = await readFile(join(dir, 'api', 'api.ts'), 'utf8')
  const types = await readFile(join(dir, 'api', 'api-types.d.ts'), 'utf8')

  const tsImplementationTemplate = `
export const getHello: Api['getHello'] = async (request: Types.GetHelloRequest): Promise<Types.GetHelloResponses> => {
  return await _getHello(baseUrl, request)
}`
  const typesTemplate = `
export interface Api {
  setBaseUrl(newUrl: string): void;
  setDefaultHeaders(headers: object): void;
  setDefaultFetchParams(fetchParams: RequestInit): void;
  /**
   * @param req - request parameters object
   * @returns the API response
   */
  getHello(req: GetHelloRequest): Promise<GetHelloResponses>;
}`

  ok(implementation)
  ok(types)
  equal(implementation.includes(tsImplementationTemplate), true)
  equal(types.includes(typesTemplate), true)
})

test('generate frontend client from path (name with dashes)', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'a-custom-name'])
  const implementation = await readFile(join(dir, 'a-custom-name', 'a-custom-name.ts'), 'utf8')
  const types = await readFile(join(dir, 'a-custom-name', 'a-custom-name-types.d.ts'), 'utf8')
  const typePlatformaticFrontendClient = types.split('\n').find((line) => line.startsWith('type PlatformaticFrontendClient = Omit<ACustomName, \'setBaseUrl\'>'))

  const importTemplate = `import type { ACustomName } from './a-custom-name-types'
import type * as Types from './a-custom-name-types'
`
  const tsImplementationTemplate = `
export const getHello: ACustomName['getHello'] = async (request: Types.GetHelloRequest): Promise<Types.GetHelloResponses> => {
  return await _getHello(baseUrl, request)
}`
  const typesTemplate = `
export interface ACustomName {
  setBaseUrl(newUrl: string): void;
  setDefaultHeaders(headers: object): void;
  setDefaultFetchParams(fetchParams: RequestInit): void;
  /**
   * @param req - request parameters object
   * @returns the API response
   */
  getHello(req: GetHelloRequest): Promise<GetHelloResponses>;
}`

  ok(implementation)
  ok(types)
  equal(implementation.includes(tsImplementationTemplate), true)
  equal(types.includes(typesTemplate), true)
  equal(implementation.includes(importTemplate), true)
  ok(typePlatformaticFrontendClient)
})

test('append query parameters to url in non-GET requests', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'append-query-params-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend', '--full', 'false'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `
const _postRoot = async (url: string, request: Types.PostRootRequest): Promise<Types.PostRootResponses> => {
  const queryParameters: (keyof NonNullable<Types.PostRootRequest>)[] = ['level']
  const searchParams = new URLSearchParams()
  if (request) {
    queryParameters.forEach((qp) => {
      const queryValue = request?.[qp]
      if (queryValue) {
        if (Array.isArray(queryValue)) {
          queryValue.forEach((p) => searchParams.append(qp, p))
        } else {
          searchParams.append(qp, queryValue.toString())
        }
      }
      delete request?.[qp]
    })
  }

  const body = request
  const isFormData = body instanceof FormData
  const headers: HeadersInit = {
    ...defaultHeaders,
    ...(isFormData || body === undefined) ? {} : defaultJsonType
  }

  const response = await fetch(\`\${url}/?\${searchParams.toString()}\`, {
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body),
    headers,
    ...defaultFetchParams
  })
`
  ok(implementation)
  equal(implementation.includes(tsImplementationTemplate), true)
})

test('handle headers parameters', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'headers-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend', '--full', 'false'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `const _postRoot = async (url: string, request: Types.PostRootRequest): Promise<Types.PostRootResponses> => {
  const body = request
  const isFormData = body instanceof FormData
  const headers: HeadersInit = {
    ...defaultHeaders,
    ...(isFormData || body === undefined) ? {} : defaultJsonType
  }
  if (request && request['level'] !== undefined) {
    headers['level'] = request['level']
    delete request['level']
  }
  if (request && request['foo'] !== undefined) {
    headers['foo'] = request['foo']
    delete request['foo']
  }

  const response = await fetch(\`\${url}/\`, {
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body),
    headers,
    ...defaultFetchParams
  })`

  ok(implementation)
  equal(implementation.includes(tsImplementationTemplate), true)
})

test('handle headers parameters in get request', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'get-headers-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend', '--full', 'false'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `
const _getRoot = async (url: string, request: Types.GetRootRequest): Promise<Types.GetRootResponses> => {
  const headers: HeadersInit = {
    ...defaultHeaders
  }
  if (request && request['level'] !== undefined) {
    headers['level'] = request['level']
    delete request['level']
  }
  if (request && request['foo'] !== undefined) {
    headers['foo'] = request['foo']
    delete request['foo']
  }

  const response = await fetch(\`\${url}/\`, {
    headers,
    ...defaultFetchParams
  })`

  ok(implementation)
  equal(implementation.includes(tsImplementationTemplate), true)
})

test('handle wildcard in path parameter', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'wildcard-in-path-openapi.json')
  await execa('node', [cliPath, fileName, '--frontend', '--name', 'fontend', '--full', 'false'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.mjs'), 'utf8')

  const tsImplementationTemplate = `
async function _getPkgScopeNameRange (url, request) {
  const headers = {
    ...defaultHeaders
  }

  const response = await fetch(\`\${url}/pkg/@\${request['scope']}/\${request['name']}/\${request['range']}/\${request['*']}\`, {
    headers,
    ...defaultFetchParams
  })
`
  ok(implementation)
  equal(implementation.includes(tsImplementationTemplate), true)
})

test('do not add headers to fetch if a get request', async (t) => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(__dirname, 'fixtures', 'empty-responses-openapi.json')
  await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend'])

  const typeFile = join(dir, 'movies', 'movies.ts')
  const data = await readFile(typeFile, 'utf-8')
  equal(data.includes(`
  const response = await fetch(\`\${url}/auth/login\`, {
    headers,
    ...defaultFetchParams
  })

  const textResponses = [200]
  if (textResponses.includes(response.status)) {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.text()
    }
  }
  const responseType = response.headers.get('content-type')?.startsWith('application/json') ? 'json' : 'text'
  return {
    statusCode: response.status as 200,
    headers: headersToJSON(response.headers),
    body: await response[responseType]()
  }`), true)
})

test('support empty response', async (t) => {
  const dir = await moveToTmpdir(after)

  const openAPIfile = join(__dirname, 'fixtures', 'empty-responses-openapi.json')
  await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend'])

  const implementationFile = join(dir, 'movies', 'movies.ts')
  const implementation = await readFile(implementationFile, 'utf-8')

  // Empty responses led to a full response returns
  equal(implementation.includes(`
  const response = await fetch(\`\${url}/auth/login\`, {
    headers,
    ...defaultFetchParams
  })

  const textResponses = [200]
  if (textResponses.includes(response.status)) {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.text()
    }
  }
  const responseType = response.headers.get('content-type')?.startsWith('application/json') ? 'json' : 'text'
  return {
    statusCode: response.status as 200,
    headers: headersToJSON(response.headers),
    body: await response[responseType]()
  }
`), true)

  const typeFile = join(dir, 'movies', 'movies-types.d.ts')
  const type = await readFile(typeFile, 'utf-8')
  equal(type.includes(`
export type GetAuthLoginResponseOK = unknown
export type GetAuthLoginResponses =
  FullResponse<GetAuthLoginResponseOK, 200>
`), true)
})

test('call response.json only for json responses', async (t) => {
  const dir = await moveToTmpdir(after)
  {
    const openAPIfile = join(__dirname, 'fixtures', 'empty-responses-openapi.json')
    await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend', '--full', 'false'])
    const implementationFile = join(dir, 'movies', 'movies.ts')
    const implementation = await readFile(implementationFile, 'utf-8')
    const expected = `
  const response = await fetch(\`\${url}/auth/login\`, {
    headers,
    ...defaultFetchParams
  })

  const textResponses = [200]
  if (textResponses.includes(response.status)) {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.text()
    }
  }
  const responseType = response.headers.get('content-type')?.startsWith('application/json') ? 'json' : 'text'
  return {
    statusCode: response.status as 200,
    headers: headersToJSON(response.headers),
    body: await response[responseType]()
  }`

    equal(implementation.includes(expected), true)
  }
  {
    const openAPIfile = join(__dirname, 'fixtures', 'frontend-openapi.json')
    await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend', '--full', 'false'])
    const implementationFile = join(dir, 'movies', 'movies.ts')
    const implementation = await readFile(implementationFile, 'utf-8')
    const expected = `
  const response = await fetch(\`\${url}/hello\`, {
    headers,
    ...defaultFetchParams
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  return await response.json()`
    equal(implementation.includes(expected), true)
  }
})

test('should match expected implementation with typescript', async (t) => {
  const dir = await moveToTmpdir(after)
  const openAPIfile = join(__dirname, 'fixtures', 'multiple-responses-openapi.json')
  await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend', '--full-response', '--full', 'false'])
  const implementationFile = join(dir, 'movies', 'movies.ts')
  const implementation = await readFile(implementationFile, 'utf-8')
  const expected = await readFile(join(__dirname, 'expected-generated-code', 'multiple-responses-movies.ts'), 'utf-8')
  equal(implementation.replace(/\r/g, ''), expected.replace(/\r/g, '')) // to make windows CI happy
})

test('serialize correctly array query parameters', async (t) => {
  const dir = await moveToTmpdir(after)
  {
    const openAPIfile = join(__dirname, 'fixtures', 'array-query-parameters-openapi.json')
    await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend', '--full', 'false'])
    const implementationFile = join(dir, 'movies', 'movies.ts')
    const implementation = await readFile(implementationFile, 'utf-8')
    const expected = `
  const queryParameters: (keyof NonNullable<Types.GetMoviesRequest>)[] = ['ids']
  const searchParams = new URLSearchParams()
  if (request) {
    queryParameters.forEach((qp) => {
      const queryValue = request?.[qp]
      if (queryValue) {
        if (Array.isArray(queryValue)) {
          queryValue.forEach((p) => searchParams.append(qp, p))
        } else {
          searchParams.append(qp, queryValue.toString())
        }
      }
      delete request?.[qp]
    })
  }`
    equal(implementation.includes(expected), true)
  }
})

test('integration test for FormData handling', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'form-data')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.register(import('@fastify/multipart'))

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'formdata', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build from './formdata.mjs'
const client = build('${app.url}')

// Create FormData instance
const formData = new FormData()
formData.append('file', new Blob(['test content'], { type: 'text/plain' }), 'test.txt')
formData.append('description', 'Test file upload')

// Test FormData submission
const response = await client.uploadFile(formData)
console.log('FormData response:', response)
`

  await writeFile(join(dir, 'formdata', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'formdata', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const [line] = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n')
  equal(line, "FormData response: { success: true, fileName: 'test.txt' }")
})

test('integration test for custom fetch parameters', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'fetch-params')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'fetch-params', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build, { setDefaultFetchParams } from './fetch-params.mjs'

// Create a client with custom fetch parameters
const client = build('${app.url}')
setDefaultFetchParams({ 
  cache: 'no-store',
  mode: 'cors'
})

// Test that fetch parameters are correctly applied
console.log(await client.getRequestInfo())
`

  await writeFile(join(dir, 'fetch-params', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'fetch-params', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n')
  equal(lines[0], '{ method: \'GET\', cache: \'no-store\', mode: \'cors\' }')
})

test('integration test for allOf and anyOf schema types', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'allof-anyof-schema')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'combined-types', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build from './combined-types.mjs'
const client = build('${app.url}')

// Test with combined schema
console.log('Combined schema response:', await client.getCombinedExample({
  id: 'test-id-123'
}))

// Test with discriminated schema
console.log('Type A response:', await client.postTypeExample({
  objectType: 'typeA',
  valueA: 'test value A'
}))

console.log('Type B response:', await client.postTypeExample({
  objectType: 'typeB',
  valueB: 42
}))
`

  await writeFile(join(dir, 'combined-types', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'combined-types', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n')

  equal(lines[0], 'Combined schema response: {')
  equal(lines[1], "  id: 'test-id-123',")
  equal(lines[2], "  name: 'combined example',")
  equal(lines[3], "  description: 'Combined properties',")
  equal(lines[4], "  timestamp: '2023-01-01T00:00:00Z'")
  equal(lines[6], "Type A response: { result: 'typeA', originalValue: 'test value A' }")
  equal(lines[7], "Type B response: { result: 'typeB', originalValue: 42 }")
})

test('integration test for optional headers', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'optional-headers')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'optheaders', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build from './optheaders.mjs'
const client = build('${app.url}')

// Test with all headers
console.log('With all headers:', await client.getHeadersInfo({ 
  requiredHeader: 'must-be-present',
  optionalHeader: 'sometimes-present'
}))

// Test with only required header
console.log('Only required header:', await client.getHeadersInfo({ 
  requiredHeader: 'must-be-present'
}))
`

  await writeFile(join(dir, 'optheaders', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'optheaders', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n')

  ok(lines[1].includes("requiredHeader: 'must-be-present'"))
  ok(lines[2].includes("optionalHeader: 'sometimes-present'"))
  equal(lines[4], "Only required header: { requiredHeader: 'must-be-present', optionalHeader: null }")
})

test('integration test for optional query parameters', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'optional-query-params')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'optparams', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build from './optparams.mjs'
const client = build('${app.url}')

// Test with all parameters
console.log('With all parameters:', await client.getOptionalParams({ 
  required: 'always-here', 
  optional: 'sometimes-here' 
}))

// Test with only required parameters
console.log('Only required parameter:', await client.getOptionalParams({ 
  required: 'always-here' 
}))
`

  await writeFile(join(dir, 'optparams', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'optparams', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n')

  equal(lines[0], 'With all parameters: { required: \'always-here\', optional: \'sometimes-here\' }')
  equal(lines[1], 'Only required parameter: { required: \'always-here\', optional: null }')
})

test('integration test for JSON and text response types', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'content-types')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'content-types', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build from './content-types.mjs'
const client = build('${app.url}')

// Test JSON response
const jsonResponse = await client.getJsonData({})
console.log('JSON response type:', typeof jsonResponse)
console.log('JSON response value:', JSON.stringify(jsonResponse))

// Test text response
const textResponse = await client.getTextData({})
console.log('Text response type:', typeof textResponse)
console.log('Text response value:', textResponse)
`

  await writeFile(join(dir, 'content-types', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'content-types', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n')

  equal(lines[0], 'JSON response type: object')
  ok(lines[1].includes('"name":"JSON data"'))
  ok(lines[1].includes('"id":123'))

  equal(lines[2], 'Text response type: string')
  equal(lines[3], 'Text response value: This is plain text data')
})

test('integration test for simple 200 response with --full option', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'full-response-simple')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'fullresponse', '--frontend', '--full'])

  const testFile = `
'use strict'

import build from './fullresponse.mjs'
const client = build('${app.url}')

// Test 200 response with full response option
const response = await client.getSimpleObject({})
console.log('Response type:', typeof response)
console.log('Response structure has statusCode:', 'statusCode' in response)
console.log('Response structure has headers:', 'headers' in response)
console.log('Response structure has body:', 'body' in response)
console.log('Response statusCode:', response.statusCode)
console.log('Response body:', JSON.stringify(response.body))
`

  await writeFile(join(dir, 'fullresponse', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'fullresponse', 'test.mjs')])

  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n')

  equal(lines[0], 'Response type: object')
  equal(lines[1], 'Response structure has statusCode: true')
  equal(lines[2], 'Response structure has headers: true')
  equal(lines[3], 'Response structure has body: true')
  equal(lines[4], 'Response statusCode: 200')
  equal(lines[5], 'Response body: {"name":"simple object","value":42,"active":true}')
})

test('integration test for 204 No Content responses', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'no-content-response')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'nocontent', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build from './nocontent.mjs'
const client = build('${app.url}')

console.log('DELETE response:', await client.deleteResource({}))
`

  await writeFile(join(dir, 'nocontent', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'nocontent', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const line = output.stdout.replace(/\u001b\[.*?m/g, '')
  ok(line.includes('body: undefined'))
})

test('integration test for query parameters', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'array-query-params')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'foobar', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build, { setBaseUrl, getQueryParamsArray } from './foobar.mjs'
const client = build('${app.url}')
console.log(await client.getQueryParamsArray({ ids: ['foo', 'bar']}))
`

  await writeFile(join(dir, 'foobar', 'test.mjs'), testFile)

  // execute the command
  const output = await execa('node', [join(dir, 'foobar', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n') // remove ANSI colors, if any
  equal(lines[0], '{ message: \'ok\', data: [ \'foo\', \'bar\' ] }')
})

test('integration test for custom headers', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'custom-headers')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'foobar', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build from './foobar.mjs'
const client = build('${app.url}', {
  headers: {
    authorization: 'Bearer foobar'
  }
})

console.log(await client.getReturnHeaders())
`

  await writeFile(join(dir, 'foobar', 'test.mjs'), testFile)

  // execute the command
  const output = await execa('node', [join(dir, 'foobar', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n') // remove ANSI colors, if any
  equal(lines[0], '{ message: \'ok\', data: { authorization: \'Bearer foobar\' } }')
})

test('integration test for DELETE without body', async (t) => {
  const fixturesDir = join(__dirname, 'fixtures', 'delete-no-body')
  try {
    await fs.unlink(join(fixturesDir, 'db.sqlite'))
  } catch {
    // noop
  }

  const app = await buildServer(join(fixturesDir, 'platformatic.db.json'))
  t.after(async () => {
    await app.close()
  })

  await app.start()
  const dir = await moveToTmpdir(after)

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'delete-api', '--frontend', '--full', 'false'])
  const testFile = `
'use strict'

import build from './delete-api.mjs'
const client = build('${app.url}')

// Test DELETE without body
const deleteResponse = await client.deleteResource({ id: '123' })
console.log('DELETE response:', deleteResponse)

// Test DELETE with path parameter
const deleteWithPathResponse = await client.deleteResourceById({ id: '456' })
console.log('DELETE with path parameter response:', deleteWithPathResponse)
`

  await writeFile(join(dir, 'delete-api', 'test.mjs'), testFile)

  const output = await execa('node', [join(dir, 'delete-api', 'test.mjs')])
  /* eslint-disable no-control-regex */
  const lines = output.stdout.replace(/\u001b\[.*?m/g, '').split('\n')

  equal(lines[0], 'DELETE response: { success: true, id: \'123\' }')
  equal(lines[1], 'DELETE with path parameter response: { success: true, id: \'456\' }')
})

test('add credentials: include in client implementation from file', async (t) => {
  const dir = await moveToTmpdir(after)
  {
    const openAPIfile = join(__dirname, 'fixtures', 'movies', 'openapi.json')
    await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend', '--with-credentials', '--full', 'false'])

    const implementationFile = join(dir, 'movies', 'movies.ts')
    const implementation = await readFile(implementationFile, 'utf-8')
    const expectedGetMethod = `
  const response = await fetch(\`\${url}/hello/\${request['name']}\`, {
    credentials: 'include',
    headers,
    ...defaultFetchParams
  })`
    const expectedPostMethod = `
  const response = await fetch(\`\${url}/movies/\${request['id']}?\${searchParams.toString()}\`, {
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body),
    credentials: 'include',
    headers,
    ...defaultFetchParams
  })`
    equal(implementation.includes(expectedGetMethod), true)
    equal(implementation.includes(expectedPostMethod), true)
  }
})

test('add credentials: include in client implementation from url', async (t) => {
  const dir = await moveToTmpdir(after)
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
  await execa('node', [join(__dirname, '..', 'cli.mjs'), app.url, '--name', 'movies', '--language', 'ts', '--frontend', '--with-credentials'])

  const implementationFile = join(dir, 'movies', 'movies.ts')
  const implementation = await readFile(implementationFile, 'utf-8')

  const expectedGetMethod = `
  const response = await fetch(\`\${url}/returnUrl\`, {
    credentials: 'include',
    headers,
    ...defaultFetchParams
  })`
  const expectedPostMethod = `
  const response = await fetch(\`\${url}/foobar\`, {
    method: 'POST',
    body: isFormData ? body : JSON.stringify(body),
    credentials: 'include',
    headers,
    ...defaultFetchParams
  })`
  equal(implementation.includes(expectedGetMethod), true)
  equal(implementation.includes(expectedPostMethod), true)
})

test('frontend client with config', async (t) => {
  const dir = await moveToTmpdir(after)
  const openAPIfile = join(__dirname, 'fixtures', 'client-with-config', 'openapi.json')
  await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'client', '--language', 'ts', '--frontend', '--config', 'watt.json', '--full', 'false'])

  const implementation = await readFile(join(dir, 'client', 'client.ts'), 'utf-8')
  ok(implementation.includes(`import type { Client } from './client-types'
import type * as Types from './client-types'`))
  ok(implementation.includes(`const _getHello = async (url: string, request: Types.GetHelloRequest): Promise<Types.GetHelloResponses> => {
  const headers: HeadersInit = {
    ...defaultHeaders
  }`))
  ok(implementation.includes(`export const getHello: Client['getHello'] = async (request: Types.GetHelloRequest): Promise<Types.GetHelloResponses> => {
  return await _getHello(baseUrl, request)
}`))

  const types = await readFile(join(dir, 'client', 'client-types.d.ts'), 'utf-8')
  ok(types.includes(`export type GetHelloResponses =
  GetHelloResponseOK`))
  ok(types.includes(`export interface Client {
  setBaseUrl(newUrl: string): void;
  setDefaultHeaders(headers: object): void;
  setDefaultFetchParams(fetchParams: RequestInit): void;
  /**
   * @param req - request parameters object
   * @returns the API response body
   */
  getHello(req: GetHelloRequest): Promise<GetHelloResponses>;
}`))
  ok(types.includes("type PlatformaticFrontendClient = Omit<Client, 'setBaseUrl'>"))
  ok(types.includes('export default function build(url: string, options?: BuildOptions): PlatformaticFrontendClient'))
})

test('frontend client with full option', async (t) => {
  const dir = await moveToTmpdir(after)
  const openAPIfile = join(__dirname, 'fixtures', 'full-req-res', 'openapi.json')
  await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'full-opt', '--language', 'ts', '--frontend', '--full'])

  const implementation = await readFile(join(dir, 'full-opt', 'full-opt.ts'), 'utf-8')
  ok(implementation.includes(`const _postHello = async (url: string, request: Types.PostHelloRequest): Promise<Types.PostHelloResponses> => {
  const queryParameters: (keyof NonNullable<Types.PostHelloRequest['query']>)[] = ['queryId']
  const searchParams = new URLSearchParams()
  if (request.query) {
    queryParameters.forEach((qp) => {
      const queryValue = request.query?.[qp]
      if (queryValue) {
        if (Array.isArray(queryValue)) {
          queryValue.forEach((p) => searchParams.append(qp, p))
        } else {
          searchParams.append(qp, queryValue.toString())
        }
      }
      delete request.query?.[qp]
    })
  }`))

  ok(implementation.includes(`if (request.headers && request.headers['headerId'] !== undefined) {
    headers['headerId'] = request.headers['headerId']
    delete request.headers['headerId']
  }`))
  ok(implementation.includes('body: isFormData ? body : JSON.stringify(body),'))

  const types = await readFile(join(dir, 'full-opt', 'full-opt-types.d.ts'), 'utf-8')
  ok(types.includes(`export type PostHelloRequest = {
  body: {
    'bodyId': string;
  }
  query: {
    'queryId': string;
  }
  headers: {
    'headerId': string;
  }
}`))
})
