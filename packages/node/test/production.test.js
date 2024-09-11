import { ok } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { verifyJSONViaHTTP } from '../../basic/test/helper.js'
import {
  isCIOnWindows,
  verifyPlatformaticComposer,
  verifyPlatformaticService,
  verifyProductionMode
} from '../../cli/test/helper.js'

process.setMaxListeners(100)

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
    checks: [verifyStandalone]
  },
  {
    id: 'node-no-configuration-composer-with-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer with a prefix)',
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-configuration-composer-without-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer without a prefix)',
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-configuration-composer-autodetect-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer by autodetecting the prefix)',
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-build-standalone',
    name: 'Node.js application with (with no build function in development mode when standalone)',
    checks: [verifyStandalone]
  },
  {
    id: 'node-no-build-composer-with-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer with a prefix)',
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-build-composer-without-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer without a prefix)',
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-no-build-composer-autodetect-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-with-build-standalone',
    name: 'Node.js application with (with a build function in development mode when standalone)',
    checks: [verifyStandalone]
  },
  {
    only: isCIOnWindows,
    id: 'node-with-build-composer-with-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer with a prefix)',
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-with-build-composer-without-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer without a prefix)',
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'node-with-build-composer-autodetect-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-no-build-standalone',
    name: 'Express with (with no build function in development mode when standalone)',
    checks: [verifyStandalone]
  },
  {
    id: 'express-no-build-composer-with-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer with a prefix)',
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-no-build-composer-without-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer without a prefix)',
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-no-build-composer-autodetect-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-with-build-standalone',
    name: 'Express with (with a build function in development mode when standalone)',
    checks: [verifyStandalone]
  },
  {
    only: isCIOnWindows,
    id: 'express-with-build-composer-with-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer with a prefix)',
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-with-build-composer-without-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer without a prefix)',
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'express-with-build-composer-autodetect-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-no-build-standalone',
    name: 'Fastify with (with no build function in development mode when standalone)',
    checks: [verifyStandalone]
  },
  {
    id: 'fastify-no-build-composer-with-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer with a prefix)',
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-no-build-composer-without-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer without a prefix)',
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-no-build-composer-autodetect-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-with-build-standalone',
    name: 'Fastify with (with a build function in development mode when standalone)',
    checks: [verifyStandalone]
  },
  {
    only: isCIOnWindows,
    id: 'fastify-with-build-composer-with-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer with a prefix)',
    checks: [verifyApplicationOnPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-with-build-composer-without-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer without a prefix)',
    checks: [verifyApplicationOnRoot, verifyPlatformaticComposer, verifyPlatformaticService]
  },
  {
    id: 'fastify-with-build-composer-autodetect-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    checks: [verifyApplicationOnAutodetectedPrefix, verifyPlatformaticComposer, verifyPlatformaticService]
  }
]

verifyProductionMode(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
