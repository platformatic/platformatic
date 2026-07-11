import { resolve } from 'node:path'
import {
  createRuntime,
  prepareRuntimeWithApplications,
  setAdditionalDependencies,
  setFixturesDir,
  verifyDevelopmentMode,
  verifyHTMLViaHTTP,
  verifyHTMLViaInject,
  verifyJSONViaHTTP,
  verifyJSONViaInject
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

const htmlContentsVite = ['<title>Lovable App</title>']
const htmlContentsNitro = ['<div id="app">Hello from Nitro</div>']

async function verifyStandalone (
  t,
  configuration,
  _language,
  htmlContents,
  _hmrUrl,
  _hmrProtocol,
  _websocketHMRHandler,
  pauseTimeout,
  additionalSetup
) {
  const { url } = await createRuntime(t, configuration, pauseTimeout, false, null, additionalSetup)

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyJSONViaHTTP(url, '/api/hello', 200, { hello: 'nitro' })
}

async function verifyComposerWithPrefix (
  t,
  configuration,
  language,
  htmlContents,
  _hmrUrl,
  _hmrProtocol,
  _websocketHMRHandler,
  pauseTimeout,
  additionalSetup
) {
  const { runtime, url } = await prepareRuntimeWithApplications(
    t,
    configuration,
    false,
    language,
    '/frontend',
    pauseTimeout,
    additionalSetup
  )

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', htmlContents)

  await verifyJSONViaHTTP(url, '/frontend/api/hello', 200, { hello: 'nitro' })
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
}

const configurations = [
  {
    id: 'standalone',
    name: 'Nitro as a Vite plugin (standalone)',
    check: verifyStandalone,
    htmlContents: htmlContentsVite,
    language: 'js'
  },
  {
    id: 'standalone-nitro',
    name: 'Nitro standalone application',
    check: verifyStandalone,
    htmlContents: htmlContentsNitro,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'Nitro (in composer with prefix)',
    check: verifyComposerWithPrefix,
    htmlContents: htmlContentsNitro,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations)
