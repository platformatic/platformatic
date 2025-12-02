import { deepStrictEqual } from 'node:assert'
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

const htmlContents = ['<!--$--><!--$--><!--/$-->']
const htmlContentsSSR = [/Hello from v<!-- -->\d+<!-- --> t<!-- -->\d+/]
const hmrTriggerFile = 'services/frontend/src/routes/index.tsx'

async function websocketHMRHandler (message, resolveConnection, resolveReload, context) {
  switch (message.type) {
    case 'connected':
      deepStrictEqual(
        (await context.runtime.inject('frontend', { url: `${context.path}src/routeTree.gen.ts` })).statusCode,
        200
      )
      resolveConnection()
      break
    case 'update':
    case 'full-reload':
      resolveReload()
      break
  }
}

const configurations = [
  {
    id: 'standalone',
    name: 'TanStack (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'TanStack (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'ts'
  },
  {
    id: 'composer-without-prefix',
    name: 'TanStack (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'TanStack (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'TanStack (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-standalone',
    name: 'TanStack SSR (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents: [/Hello from v<!-- -->\d+/],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-with-prefix',
    name: 'TanStack SSR (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'ts'
  },
  {
    id: 'ssr-without-prefix',
    name: 'TanStack SSR (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'TanStack SSR (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-custom-commands',
    name: 'TanStack SSR (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations, '', 'vite-hmr', websocketHMRHandler)
