import { resolve } from 'node:path'
import {
  createRuntime,
  prepareRuntimeWithApplications,
  setAdditionalDependencies,
  setFixturesDir,
  updateFile,
  verifyDevelopmentMode,
  verifyHMR,
  verifyHTMLViaHTTP,
  verifyHTMLViaInject,
  verifyJSONViaHTTP,
  verifyJSONViaInject
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(['nitro', 'nitropack', 'vite'])

const hmrTriggerFile = 'services/frontend/main.js'

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.type) {
    case 'connected':
      resolveConnection()
      break
    case 'full-reload':
      resolveReload()
  }
}

async function verifyStandalone (t, configuration, _language, contents, _hmrUrl, _hmrProtocol, _handler, timeout) {
  const { url } = await createRuntime(t, configuration, timeout)
  await verifyHTMLViaHTTP(url, '/', contents)
}

async function verifyVite (t, configuration, _language, contents, hmrUrl, hmrProtocol, handler, timeout) {
  const { root, runtime, url } = await createRuntime(t, configuration, timeout)
  await verifyHTMLViaHTTP(url, '/', contents)
  await verifyJSONViaHTTP(url, '/api/hello', 200, { hello: 'nitro-vite' })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/api/hello', 200, { hello: 'nitro-vite' })
  await verifyHMR(root, runtime, url, '/' + hmrUrl, hmrProtocol, handler)
}

async function verifyPrefix (t, configuration, language, contents, _hmrUrl, _hmrProtocol, _handler, timeout) {
  const { runtime, url } = await prepareRuntimeWithApplications(
    t,
    configuration,
    false,
    language,
    '/frontend',
    timeout
  )

  await verifyHTMLViaHTTP(url, '/frontend/', contents)
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', contents)
  await verifyJSONViaHTTP(url, '/frontend/api/hello', 200, { hello: 'prefixed-nitro' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/api/hello', 200, { hello: 'prefixed-nitro' })
  await verifyComposerRoutes(runtime, url, '/frontend')
}

async function verifyViteComposer (
  t,
  configuration,
  language,
  contents,
  hmrUrl,
  hmrProtocol,
  handler,
  timeout,
  additionalSetup,
  prefix
) {
  const { root, runtime, url } = await prepareRuntimeWithApplications(
    t,
    configuration,
    false,
    language,
    prefix,
    timeout,
    additionalSetup
  )

  const pagePath = prefix ? `${prefix}/` : '/'
  const apiPath = `${prefix}/api/hello`

  await verifyHTMLViaHTTP(url, pagePath, contents)
  await verifyHTMLViaInject(runtime, 'composer', prefix || '/', contents)
  await verifyJSONViaHTTP(url, apiPath, 200, { hello: 'nitro-vite' })
  await verifyHMR(root, runtime, url, `${prefix}/${hmrUrl}`, hmrProtocol, handler)
  await verifyComposerRoutes(runtime, url, prefix)
}

function verifyWithoutPrefix (...args) {
  return verifyViteComposer(...args, '')
}

async function configureRootProxy (root) {
  await updateFile(resolve(root, 'services/composer/platformatic.json'), contents => {
    const config = JSON.parse(contents)
    config.gateway.applications[1].proxy = { prefix: '' }
    return JSON.stringify(config, null, 2)
  })
}

function verifyAutodetectPrefix (...args) {
  return verifyViteComposer(...args, '/nested/base/dir')
}

function verifyCustomCommands (...args) {
  return verifyViteComposer(...args, '/frontend')
}

async function verifyComposerRoutes (runtime, url, prefix) {
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, `${prefix}/on-composer`, 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', `${prefix}/on-composer`, 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
}

verifyDevelopmentMode([
  {
    id: 'standalone',
    check: verifyVite,
    htmlContents: ['<title>Nitro Vite</title>'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'standalone-nitro',
    check: verifyStandalone,
    htmlContents: ['Hello from Nitro'],
    language: 'js'
  },
  {
    id: 'standalone-nitro-v3',
    check: verifyStandalone,
    htmlContents: ['Hello from Nitro 3'],
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    check: verifyPrefix,
    htmlContents: ['Hello from prefixed Nitro'],
    language: 'js'
  },
  {
    id: 'composer-without-prefix',
    check: verifyWithoutPrefix,
    htmlContents: ['<title>Nitro Vite</title>'],
    hmrTriggerFile,
    language: 'js',
    additionalSetup: configureRootProxy
  },
  {
    id: 'composer-autodetect-prefix',
    check: verifyAutodetectPrefix,
    htmlContents: ['<title>Nitro Vite</title>'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    check: verifyCustomCommands,
    htmlContents: ['<title>Nitro Vite</title>'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'custom-output',
    check: verifyStandalone,
    htmlContents: ['Custom Nitro output'],
    language: 'js'
  }
], '', 'vite-hmr', websocketHMRHandler)
