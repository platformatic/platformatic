import { ok } from 'node:assert'
import { resolve } from 'node:path'
import {
  createRuntime,
  getLogs,
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
  absoluteUrl = true,
  additionalCheck = null
) {
  const { runtime, url } = await prepareRuntimeWithServices(t, id, false, language, '/frontend', pauseTimeout)

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
  absoluteUrl = true,
  additionalCheck = null
) {
  const { runtime, url } = await prepareRuntimeWithServices(t, id, false, language, '/nested/base/dir', pauseTimeout)

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

  const logs = await getLogs(runtime)
  ok(logs.map(m => m.msg).includes(missingConfigurationMessage))
}

const configurations = [
  {
    id: 'node-no-configuration-standalone',
    name: 'Node.js application with (with no configuration files in development mode when standalone)',
    async check (...args) {
      await verifyStandalone(...args, verifyMissingConfigurationMessage)
    },
    language: 'js'
  },
  {
    id: 'node-no-configuration-composer-with-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer with a prefix)',
    async check (...args) {
      await verifyComposerWithPrefix(...args, false, verifyMissingConfigurationMessage)
    },
    language: 'ts'
  },
  {
    id: 'node-no-configuration-composer-without-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer without a prefix)',
    async check (...args) {
      await verifyComposerWithoutPrefix(...args, verifyMissingConfigurationMessage)
    },
    language: 'js'
  },
  {
    id: 'node-no-configuration-composer-autodetect-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer by autodetecting the prefix)',
    async check (...args) {
      await verifyComposerAutodetectPrefix(...args, false, verifyMissingConfigurationMessage)
    },
    language: 'js'
  },
  {
    id: 'node-no-configuration-composer-no-services',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer which defines no services)',
    async check (...args) {
      await verifyComposerWithoutPrefix(...args, verifyMissingConfigurationMessage)
    },
    language: 'js'
  },
  {
    id: 'node-no-build-standalone',
    name: 'Node.js application with (with no build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'node-no-build-composer-with-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'node-no-build-composer-without-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'node-no-build-composer-autodetect-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'node-with-build-standalone',
    name: 'Node.js application with (with a build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'node-with-build-composer-with-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'node-with-build-composer-without-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'node-with-build-composer-autodetect-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'express-no-build-standalone',
    name: 'Express with (with no build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'express-no-build-composer-with-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'express-no-build-composer-without-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'express-no-build-composer-autodetect-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'express-with-build-standalone',
    name: 'Express with (with a build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'express-with-build-composer-with-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'express-with-build-composer-without-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'express-with-build-composer-autodetect-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'fastify-no-build-standalone',
    name: 'Fastify with (with no build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'fastify-no-build-composer-with-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'fastify-no-build-composer-without-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'fastify-no-build-composer-autodetect-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'fastify-with-build-standalone',
    name: 'Fastify with (with a build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'fastify-with-build-composer-with-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'fastify-with-build-composer-without-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'fastify-with-build-composer-autodetect-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'koa-no-build-standalone',
    name: 'Koa with (with no build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'koa-no-build-composer-with-prefix',
    name: 'Koa with (with no build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'koa-no-build-composer-without-prefix',
    name: 'Koa with (with no build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'koa-no-build-composer-autodetect-prefix',
    name: 'Koa with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  },
  {
    id: 'koa-with-build-standalone',
    name: 'Koa with (with a build function in development mode when standalone)',
    check: verifyStandalone,
    language: 'js'
  },
  {
    id: 'koa-with-build-composer-with-prefix',
    name: 'Koa with (with a build function in development mode when exposed in a composer with a prefix)',
    check: verifyComposerWithPrefix,
    language: 'js'
  },
  {
    id: 'koa-with-build-composer-without-prefix',
    name: 'Koa with (with a build function in development mode when exposed in a composer without a prefix)',
    check: verifyComposerWithoutPrefix,
    language: 'js'
  },
  {
    id: 'koa-with-build-composer-autodetect-prefix',
    name: 'Koa with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    check: verifyComposerAutodetectPrefix,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations)
