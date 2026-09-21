import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  buildRuntime,
  configureHTTPS,
  createHTTPSDispatcher,
  prepareRuntime,
  setFixturesDir,
  startRuntime,
  verifyJSONViaHTTPS
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function startHTTPSRuntime (t, id, production) {
  const { runtime, root } = await prepareRuntime(t, id, production, null, configureHTTPS)

  if (production) {
    await buildRuntime(root)
  }

  const url = await startRuntime(t, runtime)
  ok(url.startsWith('https://'))
  return url
}

for (const id of ['express-standalone', 'fastify-standalone']) {
  test(`supports https server options in development mode with ${id}`, async t => {
    const dispatcher = createHTTPSDispatcher(t)
    const url = await startHTTPSRuntime(t, id, false)

    await verifyJSONViaHTTPS(url, '/', 200, { production: false }, dispatcher)
  })

  test(`supports https server options in production mode with ${id}`, async t => {
    const dispatcher = createHTTPSDispatcher(t)
    const url = await startHTTPSRuntime(t, id, true)

    await verifyJSONViaHTTPS(url, '/', 200, { production: true }, dispatcher)
  })
}
