import { resolve } from 'node:path'
import {
  setAdditionalDependencies,
  setFixturesDir,
  verifyDevelopmentFrontendStandalone,
  verifyDevelopmentFrontendWithAutodetectPrefix,
  verifyDevelopmentFrontendWithPrefix,
  verifyDevelopmentFrontendWithoutPrefix,
  verifyDevelopmentMode
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

const htmlContents = [/Hello from v<!-- -->\d+<!-- --> t<!-- -->\d+/, 'window.__remixRouteModules']
const hmrTriggerFile = 'services/frontend/app/root.jsx'

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.type) {
    case 'connected':
      resolveConnection()
      break
    case 'custom':
      if (message.event === 'remix:hmr') {
        resolveReload()
      }
      break
    case 'full-reload':
      resolveReload()
  }
}

const configurations = [
  {
    id: 'standalone',
    name: 'Remix (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents: [/Hello from v<!-- -->\d+/, 'window.__remixRouteModules'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'Remix (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'ts'
  },
  {
    id: 'composer-without-prefix',
    name: 'Remix (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Remix (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'Remix (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations, '', 'vite-hmr', websocketHMRHandler)
