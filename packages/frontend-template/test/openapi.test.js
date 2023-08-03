'use strict'

import { test } from 'tap'
import { buildServer } from '@platformatic/db'
import { join } from 'path'
import { processOpenAPI } from '../lib/gen-openapi.mjs'
import fs from 'fs/promises'
import { request } from 'undici'
import * as url from 'url'
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

test('build basic client from url', async ({ teardown, same, match }) => {
  try {
    await fs.unlink(join(__dirname, 'fixtures', 'movies', 'db.sqlite'))
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
  const expectedImplementation = `export const getRedirect = async (request) => {
  const response = await fetch(\`\${baseUrl}/redirect?\${new URLSearchParams(Object.entries(request || {})).toString()}\`)

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
}`
  match(implementation, expectedImplementation)
})
