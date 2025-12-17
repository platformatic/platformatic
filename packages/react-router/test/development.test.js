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

const htmlContents = ['window.__reactRouterRouteModules']
const htmlContentsSSR = [/Hello from v<!-- -->\d+<!-- --> t<!-- -->\d+/, 'window.__reactRouterRouteModules']
const hmrTriggerFile = 'services/frontend/app/routes/index.tsx'

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.type) {
    case 'connected':
      resolveConnection()
      break
    case 'custom':
      if (message.event === 'react-router:hmr') {
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
    name: 'React Router (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'React Router (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'ts'
  },
  {
    id: 'composer-without-prefix',
    name: 'React Router (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'React Router (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'React Router (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-standalone',
    name: 'React Router SSR (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents: [/Hello from v<!-- -->\d+/, 'window.__reactRouterRouteModules'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-composer-with-prefix',
    name: 'React Router SSR (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'ts'
  },
  {
    id: 'ssr-composer-without-prefix',
    name: 'React Router SSR (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-composer-autodetect-prefix',
    name: 'React Router SSR (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-composer-custom-commands',
    name: 'React Router SSR (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations, '', 'vite-hmr', websocketHMRHandler)
