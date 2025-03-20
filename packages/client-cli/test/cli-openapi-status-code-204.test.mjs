import { isFileAccessible } from '../cli.mjs'
import { moveToTmpdir } from './helper.js'
import { test, after } from 'node:test'
import { equal, ok } from 'node:assert'
import { join } from 'path'
import * as desm from 'desm'
import { execa } from 'execa'
import { promises as fs } from 'fs'
import { readFile } from 'fs/promises'

const name = 'status-code-204'
test(name, async () => {
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

  await execa('node', [desm.join(import.meta.url, '..', 'cli.mjs'), openapi, '--name', name, '--full', '--frontend', '--language', 'ts'])

  equal(await isFileAccessible(join(dir, name, name + '.cjs')), false)

  const typeFile = join(dir, name, name + '.ts')
  const data = await readFile(typeFile, 'utf-8')

  ok(data.includes(`
  const textResponses = [204]
  if (textResponses.includes(response.status)) {
    return {
      statusCode: response.status as 204,
      headers: headersToJSON(response.headers),
      body: response.status === 204 ? undefined: await response.text()
    }
  }
  const responseType = response.headers.get('content-type')?.startsWith('application/json') ? 'json' : 'text'
  return {
    statusCode: response.status as 204,
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
