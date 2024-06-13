'use strict'

import { test, after } from 'node:test'
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
  const { types, implementation } = processFrontendOpenAPI({ schema, name: 'sample', language: 'js', fullResponse: false })

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
  ok(types.includes("'messageRes': string | null;"))
  ok(types.includes("'dateTimeRes': string;"))
  ok(types.includes("'otherDateRes': string;"))
  ok(types.includes("'nullableDateRes': string | null;"))
  ok(types.includes("'normalStringRes': string;"))

  // handle non 200 code endpoint
  const expectedImplementation = `
async function _getRedirect (url, request) {

  const response = await fetch(\`\${url}/redirect\`)

  const jsonResponses = [302, 400]
  if (jsonResponses.includes(response.status)) {
    return {
      statusCode: response.status,
      headers: headersToJSON(response.headers),
      body: await response.json()
    }
  }
  if (response.headers.get('content-type') === 'application/json') {
    return {
      statusCode: response.status,
      headers: headersToJSON(response.headers),
      body: await response.json()
    }
  }
  return {
    statusCode: response.status,
    headers: headersToJSON(response.headers),
    body: await response.text()
  }
}

/**  @type {import('./sample-types.d.ts').Sample['getRedirect']} */
export const getRedirect = async (request) => {
  return await _getRedirect(baseUrl, request)
}`
  // create factory
  const factoryImplementation = `
export default function build (url) {
  url = sanitizeUrl(url)
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
  setBaseUrl(newUrl: string) : void;
  getCustomSwagger(req?: GetCustomSwaggerRequest): Promise<GetCustomSwaggerResponses>;
  getRedirect(req?: GetRedirectRequest): Promise<GetRedirectResponses>;
  getReturnUrl(req?: GetReturnUrlRequest): Promise<GetReturnUrlResponses>;
  postFoobar(req?: PostFoobarRequest): Promise<PostFoobarResponses>;
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
  setBaseUrl(newUrl: string) : void;
  getHello(req?: GetHelloRequest): Promise<GetHelloResponses>;
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

  const importTemplate = `import type { ACustomName } from './a-custom-name-types'
import type * as Types from './a-custom-name-types'
`
  const tsImplementationTemplate = `
export const getHello: ACustomName['getHello'] = async (request: Types.GetHelloRequest): Promise<Types.GetHelloResponses> => {
  return await _getHello(baseUrl, request)
}`
  const typesTemplate = `
export interface ACustomName {
  setBaseUrl(newUrl: string) : void;
  getHello(req?: GetHelloRequest): Promise<GetHelloResponses>;
}`

  ok(implementation)
  ok(types)
  equal(implementation.includes(tsImplementationTemplate), true)
  equal(types.includes(typesTemplate), true)
  equal(implementation.includes(importTemplate), true)
})

test('append query parameters to url in non-GET requests', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'append-query-params-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `
const _postRoot = async (url: string, request: Types.PostRootRequest): Promise<Types.PostRootResponses> => {
  const queryParameters: (keyof Types.PostRootRequest)[]  = ['level']
  const searchParams = new URLSearchParams()
  queryParameters.forEach((qp) => {
    if (request[qp]) {
      if (Array.isArray(request[qp])) {
        (request[qp] as string[]).forEach((p) => {
          searchParams.append(qp, p)
        })
      } else {
        searchParams.append(qp, request[qp]?.toString() || '')
      }
    }
    delete request[qp]
  })

  const headers = {
    'Content-type': 'application/json; charset=utf-8'
  }

  const response = await fetch(\`\${url}/?\${searchParams.toString()}\`, {
    method: 'POST',
    body: JSON.stringify(request),
    headers
  })
`
  ok(implementation)
  equal(implementation.includes(tsImplementationTemplate), true)
})

test('handle headers parameters', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'headers-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `
const _postRoot = async (url: string, request: Types.PostRootRequest): Promise<Types.PostRootResponses> => {
  const headers = {
    'Content-type': 'application/json; charset=utf-8'
  }
  if (request['level'] !== undefined) {
    headers['level'] = request['level']
    delete request['level']
  }
  if (request['foo'] !== undefined) {
    headers['foo'] = request['foo']
    delete request['foo']
  }

  const response = await fetch(\`\${url}/\`, {
    method: 'POST',
    body: JSON.stringify(request),
    headers
  })
`

  ok(implementation)
  equal(implementation.includes(tsImplementationTemplate), true)
})

test('handle headers parameters in get request', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'get-headers-frontend-openapi.json')
  await execa('node', [cliPath, fileName, '--language', 'ts', '--frontend', '--name', 'fontend'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.ts'), 'utf8')

  const tsImplementationTemplate = `
const _getRoot = async (url: string, request: Types.GetRootRequest): Promise<Types.GetRootResponses> => {
  if (request['level'] !== undefined) {
    headers['level'] = request['level']
    delete request['level']
  }
  if (request['foo'] !== undefined) {
    headers['foo'] = request['foo']
    delete request['foo']
  }

  const response = await fetch(\`\${url}/\`)
`
  ok(implementation)
  equal(implementation.includes(tsImplementationTemplate), true)
})

test('handle wildcard in path parameter', async (t) => {
  const dir = await moveToTmpdir(after)

  const fileName = join(__dirname, 'fixtures', 'wildcard-in-path-openapi.json')
  await execa('node', [cliPath, fileName, '--frontend', '--name', 'fontend'])
  const implementation = await readFile(join(dir, 'fontend', 'fontend.mjs'), 'utf8')

  const tsImplementationTemplate = `
async function _getPkgScopeNameRange (url, request) {

  const response = await fetch(\`\${url}/pkg/@\${request['scope']}/\${request['name']}/\${request['range']}/\${request['*']}\`)
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
  const response = await fetch(\`\${url}/auth/login\`)

  const textResponses = [200]
  if (textResponses.includes(response.status)) {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.text()
    }
  }
  if (response.headers.get('content-type') === 'application/json') {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.json() as any
    }
  }
  return {
    statusCode: response.status as 200,
    headers: headersToJSON(response.headers),
    body: await response.text() as any
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
  const response = await fetch(\`\${url}/auth/login\`)

  const textResponses = [200]
  if (textResponses.includes(response.status)) {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.text()
    }
  }
  if (response.headers.get('content-type') === 'application/json') {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.json() as any
    }
  }
  return {
    statusCode: response.status as 200,
    headers: headersToJSON(response.headers),
    body: await response.text() as any
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
    await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend'])
    const implementationFile = join(dir, 'movies', 'movies.ts')
    const implementation = await readFile(implementationFile, 'utf-8')
    const expected = `
  const response = await fetch(\`\${url}/auth/login\`)

  const textResponses = [200]
  if (textResponses.includes(response.status)) {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.text()
    }
  }
  if (response.headers.get('content-type') === 'application/json') {
    return {
      statusCode: response.status as 200,
      headers: headersToJSON(response.headers),
      body: await response.json() as any
    }
  }
  return {
    statusCode: response.status as 200,
    headers: headersToJSON(response.headers),
    body: await response.text() as any
  }`

    equal(implementation.includes(expected), true)
  }
  {
    const openAPIfile = join(__dirname, 'fixtures', 'frontend-openapi.json')
    await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend'])
    const implementationFile = join(dir, 'movies', 'movies.ts')
    const implementation = await readFile(implementationFile, 'utf-8')
    const expected = `
  const response = await fetch(\`\${url}/hello\`)

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
  await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend', '--full-response'])
  const implementationFile = join(dir, 'movies', 'movies.ts')
  const implementation = await readFile(implementationFile, 'utf-8')
  const expected = await readFile(join(__dirname, 'expected-generated-code', 'multiple-responses-movies.ts'), 'utf-8')
  equal(implementation.replace(/\r/g, ''), expected.replace(/\r/g, '')) // to make windows CI happy
})

test('serialize correctly array query parameters', async (t) => {
  const dir = await moveToTmpdir(after)
  {
    const openAPIfile = join(__dirname, 'fixtures', 'array-query-parameters-openapi.json')
    await execa('node', [join(__dirname, '..', 'cli.mjs'), openAPIfile, '--name', 'movies', '--language', 'ts', '--frontend'])
    const implementationFile = join(dir, 'movies', 'movies.ts')
    const implementation = await readFile(implementationFile, 'utf-8')
    const expected = `
  const queryParameters: (keyof Types.GetMoviesRequest)[]  = ['ids']
  const searchParams = new URLSearchParams()
  queryParameters.forEach((qp) => {
    if (request[qp]) {
      if (Array.isArray(request[qp])) {
        (request[qp] as string[]).forEach((p) => {
          searchParams.append(qp, p)
        })
      } else {
        searchParams.append(qp, request[qp]?.toString() || '')
      }
    }
    delete request[qp]
  })`
    equal(implementation.includes(expected), true)
  }
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

  await execa('node', [cliPath, join(fixturesDir, 'openapi.json'), '--name', 'foobar', '--frontend'])
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
