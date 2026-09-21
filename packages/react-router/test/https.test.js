import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  buildRuntime,
  configureHTTPS,
  createHTTPSDispatcher,
  prepareRuntime,
  setAdditionalDependencies,
  setFixturesDir,
  startRuntime,
  verifyHTMLViaHTTPS
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

async function startHTTPSRuntime (t, production) {
  const { runtime, root } = await prepareRuntime(t, 'standalone', production, null, configureHTTPS)

  if (production) {
    await buildRuntime(root)
  }

  const url = await startRuntime(t, runtime)
  ok(url.startsWith('https://'))
  return url
}

test('supports https server options in development mode', async t => {
  const dispatcher = createHTTPSDispatcher(t)
  const url = await startHTTPSRuntime(t, false)

  await verifyHTMLViaHTTPS(url, '/', ['window.__reactRouterRouteModules'], dispatcher)
})

test('supports https server options in production mode', async t => {
  const dispatcher = createHTTPSDispatcher(t)
  const url = await startHTTPSRuntime(t, true)

  await verifyHTMLViaHTTPS(url, '/', [/import\("\/assets\/entry\.client-.+\.js"\)/], dispatcher)
})
