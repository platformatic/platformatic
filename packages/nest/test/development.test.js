import { ok } from 'node:assert/strict'
import { resolve } from 'node:path'
import {
  createRuntime,
  prepareRuntimeWithServices,
  setFixturesDir,
  updateFile,
  verifyDevelopmentMode,
  verifyJSONViaHTTP,
  verifyJSONViaInject
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

function isTime (body) {
  ok(typeof body.time === 'number')
}

async function verifyStandalone (
  t,
  id,
  _language,
  _htmlContents,
  _hmrUrl,
  _hmrProtocol,
  _websocketHMRHandler,
  pauseTimeout,
  additionalCheck
) {
  const { runtime, url } = await createRuntime(t, id, pauseTimeout)

  await verifyJSONViaHTTP(url, '/', 200, { production: false })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: false })

  await additionalCheck?.(runtime)
}

async function verifyComposerWithPrefix (
  t,
  id,
  language,
  _htmlContents,
  _hmrUrl,
  _hmrProtocol,
  _websocketHMRHandler,
  pauseTimeout,
  additionalSetup,
  additionalCheck = null
) {
  const { runtime, url } = await prepareRuntimeWithServices(
    t,
    id,
    false,
    language,
    '/frontend',
    pauseTimeout,
    additionalSetup
  )

  await verifyJSONViaHTTP(url, '/frontend', 200, { production: false })
  await verifyJSONViaHTTP(url, '/frontend/', 200, { production: false })
  await verifyJSONViaHTTP(url, '/frontend/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: false })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })

  await additionalCheck?.(runtime)
}

async function verifyComposerWithoutPrefix (
  t,
  id,
  language,
  _htmlContents,
  _hmrUrl,
  _hmrProtocol,
  _websocketHMRHandler,
  pauseTimeout,
  additionalCheck
) {
  const { runtime, url } = await prepareRuntimeWithServices(t, id, false, language, '', pauseTimeout, async root => {
    await updateFile(resolve(root, 'services/composer/platformatic.json'), contents => {
      const json = JSON.parse(contents)
      json.composer.services[1].proxy = { prefix: '' }
      return JSON.stringify(json, null, 2)
    })
  })

  await verifyJSONViaHTTP(url, '/', 200, { production: false })
  await verifyJSONViaHTTP(url, '/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: false })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })

  await additionalCheck?.(runtime)
}

async function verifyComposerAutodetectPrefix (
  t,
  id,
  language,
  _htmlContents,
  _hmrUrl,
  _hmrProtocol,
  _websocketHMRHandler,
  pauseTimeout,
  additionalSetup,
  additionalCheck = null
) {
  const { runtime, url } = await prepareRuntimeWithServices(
    t,
    id,
    false,
    language,
    '/nested/base/dir',
    pauseTimeout,
    additionalSetup
  )

  await verifyJSONViaHTTP(url, '/nested/base/dir', 200, { production: false })
  await verifyJSONViaHTTP(url, '/nested/base/dir/', 200, { production: false })
  await verifyJSONViaHTTP(url, '/nested/base/dir/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/nested/base/dir', 200, { production: false })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/nested/base/dir/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })

  await additionalCheck?.(runtime)
}

const configurations = [
  {
    id: 'express-standalone',
    name: 'NestJS application (with Express adapter when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'fastify-standalone',
    name: 'NestJS application (with Fastify adapter when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'NestJS application (in composer with prefix)',
    check: verifyComposerWithPrefix,
    language: 'ts'
  },
  {
    id: 'composer-without-prefix',
    name: 'NestJS application (in composer without prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'NestJS application (in composer with autodetected prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'NestJS (in composer with prefix using custom commands)',
    check: verifyComposerWithPrefix,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations)
