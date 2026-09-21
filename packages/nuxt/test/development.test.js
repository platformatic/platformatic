import { resolve } from 'node:path'
import {
  createRuntime,
  prepareRuntimeWithApplications,
  setAdditionalDependencies,
  setFixturesDir,
  updateFile,
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

const htmlContents = ['<script>window.__NUXT__={}']
const htmlContentsSSR = [/Hello from v\d+ t\d+/]

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

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
}

async function verifyComposerWithoutPrefix (
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
    '',
    pauseTimeout,
    async root => {
      await updateFile(resolve(root, 'services/composer/platformatic.json'), contents => {
        const json = JSON.parse(contents)
        json.gateway.applications[1].proxy = { prefix: '' }
        return JSON.stringify(json, null, 2)
      })
    }
  )

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/', htmlContents)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
}

async function verifyComposerWithAutodetectPrefix (
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
    '/nested/base/dir',
    pauseTimeout,
    additionalSetup
  )

  await verifyHTMLViaHTTP(url, '/nested/base/dir/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/nested/base/dir', htmlContents)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
}

const configurations = [
  {
    id: 'standalone',
    name: 'Nuxt (standalone)',
    check: verifyStandalone,
    htmlContents,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'Nuxt (in composer with prefix)',
    check: verifyComposerWithPrefix,
    htmlContents,
    language: 'js'
  },
  {
    id: 'composer-without-prefix',
    name: 'Nuxt (in composer without prefix)',
    check: verifyComposerWithoutPrefix,
    htmlContents,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Nuxt (in composer with autodetected prefix)',
    check: verifyComposerWithAutodetectPrefix,
    htmlContents,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'Nuxt (in composer with prefix using custom commands)',
    check: verifyComposerWithPrefix,
    htmlContents,
    language: 'js'
  },
  {
    id: 'ssr-standalone',
    name: 'Nuxt SSR (standalone)',
    check: verifyStandalone,
    htmlContents: htmlContentsSSR,
    language: 'js'
  },
  {
    id: 'ssr-with-prefix',
    name: 'Nuxt SSR (in composer with prefix)',
    check: verifyComposerWithPrefix,
    htmlContents: htmlContentsSSR,
    language: 'ts'
  },
  {
    id: 'ssr-without-prefix',
    name: 'Nuxt SSR (in composer without prefix)',
    check: verifyComposerWithoutPrefix,
    htmlContents: htmlContentsSSR,
    language: 'js'
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Nuxt SSR (in composer with autodetected prefix)',
    check: verifyComposerWithAutodetectPrefix,
    htmlContents: htmlContentsSSR,
    language: 'js'
  },
  {
    id: 'ssr-custom-commands',
    name: 'Nuxt SSR (in composer with prefix using custom commands)',
    check: verifyComposerWithPrefix,
    htmlContents: htmlContentsSSR,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations)
