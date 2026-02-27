import { resolve } from 'node:path'
import {
  setFixturesDir,
  verifyDevelopmentFrontendStandalone,
  verifyDevelopmentFrontendWithAutodetectPrefix,
  verifyDevelopmentFrontendWithPrefix,
  verifyDevelopmentFrontendWithoutPrefix,
  verifyDevelopmentMode
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const htmlContentsAppRouter = ['self.__VINEXT_RSC_PARAMS__=']
const htmlContentsPagesRouter = [/Hello from v(?:<!-- -->)?\d+/]
const hmrTriggerFileAppRouter = 'services/frontend/app/page.jsx'
const hmrTriggerFilePagesRouter = 'services/frontend/pages/index.jsx'

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.type) {
    case 'connected':
      resolveConnection()
      break
    case 'custom':
      if (message.event === 'rsc:update') {
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
    name: 'Vinext (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents: htmlContentsAppRouter,
    hmrTriggerFile: hmrTriggerFileAppRouter,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'Vinext (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsAppRouter,
    hmrTriggerFile: hmrTriggerFileAppRouter,
    language: 'js'
  },
  {
    id: 'composer-without-prefix',
    name: 'Vinext (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents: htmlContentsPagesRouter,
    hmrTriggerFile: hmrTriggerFilePagesRouter,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Vinext (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents: htmlContentsAppRouter,
    hmrTriggerFile: hmrTriggerFileAppRouter,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'Vinext (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsAppRouter,
    hmrTriggerFile: hmrTriggerFileAppRouter,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations, '', 'vite-hmr', websocketHMRHandler)
