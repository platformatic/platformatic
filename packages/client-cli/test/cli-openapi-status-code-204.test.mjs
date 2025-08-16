import { execa } from 'execa'
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'
import { equal, ok } from 'node:assert'
import { after, test } from 'node:test'
import { join } from 'path'
import { isFileAccessible } from '../cli.mjs'
import { moveToTmpdir } from './helper.js'

const name = 'status-code-204'
test(name, async () => {
  const openapi = join(import.meta.dirname, 'fixtures', name, 'openapi.json')
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

  await execa('node', [join(import.meta.dirname, '..', 'cli.mjs'), openapi, '--name', name, '--full', '--frontend', '--language', 'ts'])

  equal(await isFileAccessible(join(dir, name, name + '.js')), false)

  const typeDef = join(dir, name, name + '-types.d.ts')
  const def = await readFile(typeDef, 'utf-8')
  ok(def.includes(`export type PutMartelloRequest = {
  
}

export type PutMartelloResponseOK = { 'name'?: string; 'value'?: number; 'active'?: boolean }
export type PutMartelloResponseCreated = boolean
export type PutMartelloResponseAccepted = unknown
export type PutMartelloResponseNoContent = unknown
export type PutMartelloResponses =
  FullResponse<PutMartelloResponseOK, 200>
  | FullResponse<PutMartelloResponseCreated, 201>
  | FullResponse<PutMartelloResponseAccepted, 202>
  | FullResponse<undefined, 204>



export interface StatusCode204 {
  setBaseUrl(newUrl: string): void;
  setDefaultHeaders(headers: object): void;
  setDefaultFetchParams(fetchParams: RequestInit): void;
  /**
   * @param req - request parameters object
   * @returns the API response
   */
  putMartello(req: PutMartelloRequest): Promise<PutMartelloResponses>;
}
type PlatformaticFrontendClient = Omit<StatusCode204, 'setBaseUrl'>
type BuildOptions = {
  headers?: object
}
export default function build(url: string, options?: BuildOptions): PlatformaticFrontendClient`))

  const typeFile = join(dir, name, name + '.ts')
  const data = await readFile(typeFile, 'utf-8')
  ok(data.includes(`
  if (response.status === 204) {
    return { statusCode: response.status, headers: headersToJSON(response.headers), body: undefined }
  }
  const textResponses = [202]
  if (textResponses.includes(response.status)) {
    return {
      statusCode: response.status as 202,
      headers: headersToJSON(response.headers),
      body: await response.text()
    }
  }
  const jsonResponses = [200, 201]
  if (jsonResponses.includes(response.status)) {
    return {
      statusCode: response.status as 200 | 201,
      headers: headersToJSON(response.headers),
      body: await response.json()
    }
  }
  const responseType = response.headers.get('content-type')?.startsWith('application/json') ? 'json' : 'text'
  return {
    statusCode: response.status as 200 | 201 | 202 | 204,
    headers: headersToJSON(response.headers),
    body: await response[responseType]()
  }
}

export const putMartello: StatusCode204['putMartello'] = async (request: Types.PutMartelloRequest): Promise<Types.PutMartelloResponses> => {
  return await _putMartello(baseUrl, request)
}
type BuildOptions = {
  headers?: object
}
export default function build (url: string, options?: BuildOptions) {
  url = sanitizeUrl(url)
  if (options?.headers) {
    defaultHeaders = options.headers
  }
  return {
    putMartello: _putMartello.bind(url, ...arguments)
  }
}`))
})
