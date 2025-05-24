import { ok } from 'node:assert/strict'
import { resolve } from 'node:path'
import {
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyJSONViaHTTP,
  verifyJSONViaInject
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const files = ['services/frontend/dist/main.js']

function isTime (body) {
  ok(typeof body.time === 'number')
}

async function verifyStandalone (t, url, runtime) {
  await verifyJSONViaHTTP(url, '/', 200, { production: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: true })
}

async function verifyComposerWithPrefix (t, url, runtime) {
  await verifyJSONViaHTTP(url, '/frontend', 200, { production: true })
  await verifyJSONViaHTTP(url, '/frontend/', 200, { production: true })
  await verifyJSONViaHTTP(url, '/frontend/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: true })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })
}

async function verifyComposerWithoutPrefix (t, url, runtime) {
  await verifyJSONViaHTTP(url, '/', 200, { production: true })
  await verifyJSONViaHTTP(url, '/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/', 200, { production: true })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })
}

async function verifyComposerAutodetectPrefix (t, url, runtime) {
  await verifyJSONViaHTTP(url, '/nested/base/dir', 200, { production: true })
  await verifyJSONViaHTTP(url, '/nested/base/dir/', 200, { production: true })
  await verifyJSONViaHTTP(url, '/nested/base/dir/time', 200, isTime)
  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/mesh', 200, { ok: true })

  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/nested/base/dir', 200, { production: true })
  await verifyJSONViaInject(runtime, 'frontend', 'GET', '/nested/base/dir/time', 200, isTime)
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/mesh', 200, { ok: true })
}

const configurations = [
  {
    id: 'express-standalone',
    name: 'NestJS application (with Express adapter when standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    id: 'fastify-standalone',
    name: 'NestJS application (with Fastify adapter when standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-with-prefix',
    name: 'NestJS application (in composer with prefix)',
    files,
    checks: [verifyComposerWithPrefix],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'composer-without-prefix',
    name: 'NestJS application (in composer without prefix)',
    files,
    checks: [verifyComposerWithoutPrefix],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'NestJS application (in composer with autodetected prefix)',
    files,
    checks: [verifyComposerAutodetectPrefix],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'composer-custom-commands',
    name: 'NestJS (in composer with prefix using custom commands)',
    files,
    checks: [verifyComposerWithPrefix],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
