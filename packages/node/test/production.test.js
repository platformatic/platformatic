import { ok } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { verifyJSONViaHTTP } from '../../basic/test/helper.js'
import {
  internalServicesFiles,
  isCIOnWindows,
  verifyBuildAndProductionMode,
  verifyPlatformaticComposer,
  verifyPlatformaticService
} from '../../cli/test/helper.js'

process.setMaxListeners(100)

const nodeCJSFiles = ['services/frontend/index.js']
const nodeESMFiles = ['services/frontend/index.mjs']
const nodeCustomBuildFiles = ['services/frontend/dist/pre/timestamp', 'services/frontend/dist/index.js']

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

const configurations = [
  {
    id: 'node-no-configuration-standalone',
    name: 'Node.js application with (with no configuration files in development mode when standalone)',
    files: nodeESMFiles,
    checks: [verifyStandalone]
  },
  {
    id: 'node-no-configuration-composer-with-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer with a prefix)',
    files: [...nodeESMFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-configuration-composer-without-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer without a prefix)',
    files: [...nodeESMFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-configuration-composer-autodetect-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeESMFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-configuration-composer-no-services',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer which defines no services)',
    files: [...nodeESMFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-build-standalone',
    name: 'Node.js application with (with no build function in development mode when standalone)',
    files: nodeCustomBuildFiles,
    checks: [verifyStandalone]
  },
  {
    id: 'node-no-build-composer-with-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-build-composer-without-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-build-composer-autodetect-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-with-build-standalone',
    name: 'Node.js application with (with a build function in development mode when standalone)',
    files: ['services/frontend/unusual.js'],
    checks: [verifyStandalone]
  },
  {
    only: isCIOnWindows,
    id: 'node-with-build-composer-with-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-with-build-composer-without-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-with-build-composer-autodetect-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-no-build-standalone',
    name: 'Express with (with no build function in development mode when standalone)',
    files: nodeCJSFiles,
    checks: [verifyStandalone]
  },
  {
    id: 'express-no-build-composer-with-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-no-build-composer-without-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-no-build-composer-autodetect-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-with-build-standalone',
    name: 'Express with (with a build function in development mode when standalone)',
    files: nodeCJSFiles,
    checks: [verifyStandalone]
  },
  {
    only: isCIOnWindows,
    id: 'express-with-build-composer-with-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-with-build-composer-without-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-with-build-composer-autodetect-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-no-build-standalone',
    name: 'Fastify with (with no build function in development mode when standalone)',
    files: nodeCJSFiles,
    checks: [verifyStandalone]
  },
  {
    id: 'fastify-no-build-composer-with-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-no-build-composer-without-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-no-build-composer-autodetect-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-with-build-standalone',
    name: 'Fastify with (with a build function in development mode when standalone)',
    files: nodeCJSFiles,
    checks: [verifyStandalone]
  },
  {
    only: isCIOnWindows,
    id: 'fastify-with-build-composer-with-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-with-build-composer-without-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-with-build-composer-autodetect-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'koa-no-build-standalone',
    name: 'Koa with (with no build function in development mode when standalone)',
    files: nodeCJSFiles,
    checks: [verifyStandalone]
  },
  {
    id: 'koa-no-build-composer-with-prefix',
    name: 'Koa with (with no build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'koa-no-build-composer-without-prefix',
    name: 'Koa with (with no build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'koa-no-build-composer-autodetect-prefix',
    name: 'Koa with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'koa-with-build-standalone',
    name: 'Koa with (with a build function in development mode when standalone)',
    files: nodeCJSFiles,
    checks: [verifyStandalone]
  },
  {
    only: isCIOnWindows,
    id: 'koa-with-build-composer-with-prefix',
    name: 'Koa with (with a build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'koa-with-build-composer-without-prefix',
    name: 'Koa with (with a build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'koa-with-build-composer-autodetect-prefix',
    name: 'Koa with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeCJSFiles, ...internalServicesFiles],
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyBuildAndProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
