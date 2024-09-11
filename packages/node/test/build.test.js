import { fileURLToPath } from 'node:url'
import { internalServicesFiles, verifyBuild } from '../../cli/test/helper.js'

process.setMaxListeners(100)

const nodeFiles = ['services/frontend/index.js']
const nodeCustomBuildFiles = ['services/frontend/dist/pre/timestamp', 'services/frontend/dist/index.js']

const configurations = [
  {
    id: 'node-no-configuration-standalone',
    name: 'Node.js application with (with no configuration files in development mode when standalone)',
    files: nodeFiles
  },
  {
    id: 'node-no-configuration-composer-with-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer with a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'node-no-configuration-composer-without-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer without a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'node-no-configuration-composer-autodetect-prefix',
    name: 'Node.js application with (with no configuration files in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'node-no-build-standalone',
    name: 'Node.js application with (with no build function in development mode when standalone)',
    files: nodeCustomBuildFiles
  },
  {
    id: 'node-no-build-composer-with-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'node-no-build-composer-without-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'node-no-build-composer-autodetect-prefix',
    name: 'Node.js application with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'node-with-build-standalone',
    name: 'Node.js application with (with a build function in development mode when standalone)',
    files: ['services/frontend/unusual.js']
  },
  {
    id: 'node-with-build-composer-with-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'node-with-build-composer-without-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'node-with-build-composer-autodetect-prefix',
    name: 'Node.js application with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'express-no-build-standalone',
    name: 'Express with (with no build function in development mode when standalone)',
    files: nodeFiles
  },
  {
    id: 'express-no-build-composer-with-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'express-no-build-composer-without-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'express-no-build-composer-autodetect-prefix',
    name: 'Express with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'express-with-build-standalone',
    name: 'Express with (with a build function in development mode when standalone)',
    files: nodeFiles
  },
  {
    id: 'express-with-build-composer-with-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'express-with-build-composer-without-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'express-with-build-composer-autodetect-prefix',
    name: 'Express with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'fastify-no-build-standalone',
    name: 'Fastify with (with no build function in development mode when standalone)',
    files: nodeFiles
  },
  {
    id: 'fastify-no-build-composer-with-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'fastify-no-build-composer-without-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'fastify-no-build-composer-autodetect-prefix',
    name: 'Fastify with (with no build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'fastify-with-build-standalone',
    name: 'Fastify with (with a build function in development mode when standalone)',
    files: nodeFiles
  },
  {
    id: 'fastify-with-build-composer-with-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer with a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'fastify-with-build-composer-without-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer without a prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  },
  {
    id: 'fastify-with-build-composer-autodetect-prefix',
    name: 'Fastify with (with a build function in development mode when exposed in a composer by autodetecting the prefix)',
    files: [...nodeFiles, ...internalServicesFiles]
  }
]

verifyBuild(fileURLToPath(new URL('fixtures', import.meta.url)), configurations)
