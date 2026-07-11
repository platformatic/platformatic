import { resolve } from 'node:path'
import {
  setAdditionalDependencies,
  setFixturesDir,
  verifyBuildAndProductionMode,
  verifyHTMLViaHTTP,
  verifyJSONViaHTTP,
  verifyPlatformaticGateway,
  verifyPlatformaticService
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

const files = ['services/frontend/.output/server/index.mjs']

const htmlContentsVite = ['<title>Lovable App</title>']
const htmlContentsNitro = ['<div id="app">Hello from Nitro</div>']

function verifyStandalone (htmlContents) {
  return async function (_, url) {
    await verifyHTMLViaHTTP(url, '/', htmlContents)
    await verifyJSONViaHTTP(url, '/api/hello', 200, { hello: 'nitro' })
  }
}

async function verifyComposerOnPrefix (_, url) {
  await verifyHTMLViaHTTP(url, '/frontend/', htmlContentsNitro)
  await verifyJSONViaHTTP(url, '/frontend/api/hello', 200, { hello: 'nitro' })
}

const configurations = [
  {
    id: 'standalone',
    name: 'Nitro as a Vite plugin (standalone)',
    files,
    checks: [verifyStandalone(htmlContentsVite)],
    language: 'js',
    prefix: ''
  },
  {
    id: 'standalone-nitro',
    name: 'Nitro standalone application',
    files,
    checks: [verifyStandalone(htmlContentsNitro)],
    language: 'js',
    prefix: ''
  },
  {
    id: 'composer-with-prefix',
    name: 'Nitro (in composer with prefix)',
    files,
    checks: [verifyComposerOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
    language: 'js',
    prefix: '/frontend'
  }
]

verifyBuildAndProductionMode(configurations)
