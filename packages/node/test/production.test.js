import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import {
  internalApplicationsFiles,
  isCIOnWindows,
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyJSONViaHTTP,
  verifyPlatformaticGateway,
  verifyPlatformaticService
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const files = ['services/frontend/index.js']
const filesESM = ['services/frontend/index.mjs']
const filesCustomBuild = ['services/frontend/dist/pre/timestamp', 'services/frontend/dist/index.js']

function isTime (body) {
  ok(typeof body.time === 'number')
}

async function verifyStandalone (t, url) {
  await verifyJSONViaHTTP(url, '/', 200, { production: true })
}

async function verifyApplicationOnRoot (t, url) {
  await verifyJSONViaHTTP(url, '/', 200, { production: true })
  await verifyJSONViaHTTP(url, '/time', 200, isTime)
}

async function verifyApplicationOnPrefix (t, url) {
  await verifyJSONViaHTTP(url, '/frontend/', 200, { production: true })
  await verifyJSONViaHTTP(url, '/frontend', 200, { production: true })
  await verifyJSONViaHTTP(url, '/frontend/time', 200, isTime)
}

async function verifyApplicationOnAutodetectedPrefix (t, url) {
  await verifyJSONViaHTTP(url, '/nested/base/dir', 200, { production: true })
  await verifyJSONViaHTTP(url, '/nested/base/dir/', 200, { production: true })
  await verifyJSONViaHTTP(url, '/nested/base/dir/time', 200, isTime)
}

async function verifyFilename (t, url) {
  const response = await fetch(url + '/frontend/filename')
  deepStrictEqual(response.status, 200)
  ok((await response.text()).endsWith('index.ts'))
}

const configurations = [
  {
    id: 'node-no-configuration-standalone',
    name: 'Node.js application (with no configuration files in development mode when standalone)',
    files: filesESM,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    id: 'node-no-configuration-composer-with-prefix',
    name: 'Node.js application (with no configuration files in development mode when exposed in a composer with a prefix)',
    files: [...filesESM, ...internalApplicationsFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'node-no-configuration-composer-without-prefix',
    name: 'Node.js application (with no configuration files in development mode when exposed in a composer without a prefix)',
    files: filesESM,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'node-no-configuration-composer-autodetect-prefix',
    name: 'Node.js application (with no configuration files in development mode when exposed in a composer by autodetecting the prefix)',
    files: filesESM,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'node-no-configuration-composer-no-services',
    name: 'Node.js application (with no configuration files in development mode when exposed in a composer which defines no applications)',
    files: filesESM,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'node-no-build-standalone',
    name: 'Node.js application (with no build function in development mode when standalone)',
    files: filesCustomBuild,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    id: 'node-no-build-composer-with-prefix',
    name: 'Node.js application (with no build function in development mode when exposed in a composer with a prefix)',
    files,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'node-no-build-composer-with-prefix-ts',
    name: 'Node.js application (with no build function in development mode when exposed in a composer with a prefix in TypeScript)',
    files: ['services/frontend/index.ts'],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService, verifyFilename],
    language: 'ts',
    prefix: '/frontend'
  },
  {
    id: 'node-no-build-composer-without-prefix',
    name: 'Node.js application (with no build function in development mode when exposed in a composer without a prefix)',
    files,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'node-no-build-composer-autodetect-prefix',
    name: 'Node.js application (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'node-with-build-standalone',
    name: 'Node.js application (with a build function in development mode when standalone)',
    files: ['services/frontend/unusual.js'],
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    id: 'node-with-build-no-main',
    name: 'Node.js application (with a build function in development mode when standalone)',
    files: ['services/frontend/dist/server.js'],
    checks: [verifyStandalone],
    language: 'ts',
    prefix: ''
  },
  {
    only: isCIOnWindows,
    id: 'node-with-build-composer-with-prefix',
    name: 'Node.js application (with a build function in development mode when exposed in a composer with a prefix)',
    files,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'node-with-build-composer-without-prefix',
    name: 'Node.js application (with a build function in development mode when exposed in a composer without a prefix)',
    files,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'node-with-build-composer-autodetect-prefix',
    name: 'Node.js application (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'express-no-build-standalone',
    name: 'Express (with no build function in development mode when standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    id: 'express-no-build-composer-with-prefix',
    name: 'Express (with no build function in development mode when exposed in a composer with a prefix)',
    files,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'express-no-build-composer-without-prefix',
    name: 'Express (with no build function in development mode when exposed in a composer without a prefix)',
    files,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'express-no-build-composer-autodetect-prefix',
    name: 'Express (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'express-with-build-standalone',
    name: 'Express (with a build function in development mode when standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    only: isCIOnWindows,
    id: 'express-with-build-composer-with-prefix',
    name: 'Express (with a build function in development mode when exposed in a composer with a prefix)',
    files,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'express-with-build-composer-without-prefix',
    name: 'Express (with a build function in development mode when exposed in a composer without a prefix)',
    files,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'express-with-build-composer-autodetect-prefix',
    name: 'Express (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'fastify-no-build-standalone',
    name: 'Fastify (with no build function in development mode when standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    id: 'fastify-no-build-composer-with-prefix',
    name: 'Fastify (with no build function in development mode when exposed in a composer with a prefix)',
    files,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'fastify-no-build-composer-without-prefix',
    name: 'Fastify (with no build function in development mode when exposed in a composer without a prefix)',
    files,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'fastify-no-build-composer-autodetect-prefix',
    name: 'Fastify (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'fastify-with-build-standalone',
    name: 'Fastify (with a build function in development mode when standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    only: isCIOnWindows,
    id: 'fastify-with-build-composer-with-prefix',
    name: 'Fastify (with a build function in development mode when exposed in a composer with a prefix)',
    files,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'fastify-with-build-composer-without-prefix',
    name: 'Fastify (with a build function in development mode when exposed in a composer without a prefix)',
    files,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'fastify-with-build-composer-autodetect-prefix',
    name: 'Fastify (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'koa-no-build-standalone',
    name: 'Koa (with no build function in development mode when standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    id: 'koa-no-build-composer-with-prefix',
    name: 'Koa (with no build function in development mode when exposed in a composer with a prefix)',
    files,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'koa-no-build-composer-without-prefix',
    name: 'Koa (with no build function in development mode when exposed in a composer without a prefix)',
    files,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'koa-no-build-composer-autodetect-prefix',
    name: 'Koa (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  },
  {
    id: 'koa-with-build-standalone',
    name: 'Koa (with a build function in development mode when standalone)',
    files,
    checks: [verifyStandalone],
    language: 'js',
    prefix: ''
  },
  {
    only: isCIOnWindows,
    id: 'koa-with-build-composer-with-prefix',
    name: 'Koa (with a build function in development mode when exposed in a composer with a prefix)',
    files,
    checks: [verifyApplicationOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  },
  {
    id: 'koa-with-build-composer-without-prefix',
    name: 'Koa (with a build function in development mode when exposed in a composer without a prefix)',
    files,
    checks: [verifyApplicationOnRoot, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: ''
  },
  {
    id: 'koa-with-build-composer-autodetect-prefix',
    name: 'Koa (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files,
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/nested/base/dir'
  }
]

verifyBuildAndProductionMode(configurations)
