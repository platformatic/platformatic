import { kMetadata } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import {
  createRuntime,
  getLogsFromFile,
  isCIOnWindows,
  LOGS_TIMEOUT,
  prepareRuntimeWithServices,
  setFixturesDir,
  sleep,
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
  absoluteUrl = true,
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

  if (absoluteUrl) {
    await verifyJSONViaInject(runtime, 'frontend', 'GET', '/frontend/', 200, { production: false })
    await verifyJSONViaInject(runtime, 'frontend', 'GET', '/frontend/time', 200, isTime)
  } else {
    await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: false })
    await verifyJSONViaInject(runtime, 'frontend', 'GET', '/time', 200, isTime)
  }
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
  absoluteUrl = true,
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

  if (absoluteUrl) {
    await verifyJSONViaInject(runtime, 'frontend', 'GET', '/nested/base/dir/', 200, { production: false })
    await verifyJSONViaInject(runtime, 'frontend', 'GET', '/nested/base/dir/time', 200, isTime)
  } else {
    await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: false })
    await verifyJSONViaInject(runtime, 'frontend', 'GET', '/time', 200, isTime)
  }
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })

  await additionalCheck?.(runtime)
}

async function verifyMissingConfigurationMessage (runtime) {
  const missingConfigurationMessage =
    'The service "frontend" had no valid entrypoint defined in the package.json file. Falling back to the file "index.mjs".'

  // Wait for logs to be flushed
  await sleep(LOGS_TIMEOUT)

  const config = await runtime.getRuntimeConfig(true)
  const logs = await getLogsFromFile(config[kMetadata].root)

  ok(logs.map(m => m.msg).includes(missingConfigurationMessage))
}

async function verifyFilename (runtime) {
  const { statusCode, body } = await runtime.inject('frontend', { url: '/frontend/filename' })
  deepStrictEqual(statusCode, 200)
  ok(body.endsWith('index.ts'))
}

const configurations = [
  {
    id: 'node-no-configuration-standalone',
    name: 'Node.js application (with no configuration files in development mode when standalone)',
    async check (...args) {
      args[8] = verifyMissingConfigurationMessage
      await verifyStandalone(...args)
    },
    language: 'js'
  },
  {
    id: 'node-no-configuration-composer-with-prefix',
    name: 'Node.js application (with no configuration files in development mode when exposed in a composer with a prefix)',
    async check (...args) {
      await verifyComposerWithPrefix(...args, false)
    },
    language: 'ts'
  },
  {
    id: 'node-no-configuration-composer-without-prefix',
    name: 'Node.js application (with no configuration files in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'node-no-configuration-composer-autodetect-prefix',
    name: 'Node.js application (with no configuration files in development mode when exposed in a composer by autodetecting the prefix)',
    async check (...args) {
      await verifyComposerAutodetectPrefix(...args, false)
    },
    language: 'js'
  },
  {
    id: 'node-no-configuration-composer-no-services',
    name: 'Node.js application (with no configuration files in development mode when exposed in a composer which defines no services)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'node-no-build-standalone',
    name: 'Node.js application (with no build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'node-no-build-composer-with-prefix',
    name: 'Node.js application (with no build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'node-no-build-composer-with-prefix-ts',
    name: 'Node.js application (with no build function in development mode when exposed in a composer with a prefix in TypeScript)',
    async check (...args) {
      await verifyComposerWithPrefix(...args, true, verifyFilename)
    },
    language: 'ts'
  },
  {
    id: 'node-no-build-composer-without-prefix',
    name: 'Node.js application (with no build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'node-no-build-composer-autodetect-prefix',
    name: 'Node.js application (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'node-with-build-standalone',
    name: 'Node.js application (with a build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    only: isCIOnWindows,
    id: 'node-with-build-composer-with-prefix',
    name: 'Node.js application (with a build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'node-with-build-composer-without-prefix',
    name: 'Node.js application (with a build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'node-with-build-composer-autodetect-prefix',
    name: 'Node.js application (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'express-no-build-standalone',
    name: 'Express (with no build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'express-no-build-composer-with-prefix',
    name: 'Express (with no build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'express-no-build-composer-without-prefix',
    name: 'Express (with no build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'express-no-build-composer-autodetect-prefix',
    name: 'Express (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'express-with-build-standalone',
    name: 'Express (with a build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    only: isCIOnWindows,
    id: 'express-with-build-composer-with-prefix',
    name: 'Express (with a build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'express-with-build-composer-without-prefix',
    name: 'Express (with a build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'express-with-build-composer-autodetect-prefix',
    name: 'Express (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'fastify-no-build-standalone',
    name: 'Fastify (with no build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'fastify-no-build-composer-with-prefix',
    name: 'Fastify (with no build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'fastify-no-build-composer-without-prefix',
    name: 'Fastify (with no build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'fastify-no-build-composer-autodetect-prefix',
    name: 'Fastify (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'fastify-with-build-standalone',
    name: 'Fastify (with a build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    only: isCIOnWindows,
    id: 'fastify-with-build-composer-with-prefix',
    name: 'Fastify (with a build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'fastify-with-build-composer-without-prefix',
    name: 'Fastify (with a build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'fastify-with-build-composer-autodetect-prefix',
    name: 'Fastify (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'koa-no-build-standalone',
    name: 'Koa (with no build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'koa-no-build-composer-with-prefix',
    name: 'Koa (with no build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'koa-no-build-composer-without-prefix',
    name: 'Koa (with no build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'koa-no-build-composer-autodetect-prefix',
    name: 'Koa (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'koa-with-build-standalone',
    name: 'Koa (with a build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    only: isCIOnWindows,
    id: 'koa-with-build-composer-with-prefix',
    name: 'Koa (with a build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'koa-with-build-composer-without-prefix',
    name: 'Koa (with a build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'koa-with-build-composer-autodetect-prefix',
    name: 'Koa (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations)
