import { resolve } from 'node:path'
import {
  setFixturesDir,
  verifyDevelopmentFrontendStandalone,
  verifyDevelopmentFrontendWithAutodetectPrefix,
  verifyDevelopmentFrontendWithPrefix,
  verifyDevelopmentFrontendWithoutPrefix,
  verifyDevelopmentMode
} from '../../basic/test/helper.js'
import { copyServerEntrypoint } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const htmlContentsSSR = ['<title>Vite App</title>', /Hello from v\d+ t\d+/]
const hmrTriggerFile = 'services/frontend/main.js'
const hmrTriggerFileSSR = 'services/frontend/client/index.js'

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.type) {
    case 'connected':
      resolveConnection()
      break
    case 'full-reload':
      resolveReload()
  }
}

const configurations = [
  {
    id: 'standalone',
    name: 'Vite (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents: ['<title>Vite App</title>', '<script type="module" src="/main.js"></script>'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'Vite (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<title>Vite App</title>', '<script type="module" src="/frontend/main.js"></script>'],
    hmrTriggerFile,
    language: 'ts'
  },
  {
    id: 'composer-without-prefix',
    name: 'Vite (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents: ['<title>Vite App</title>', '<script type="module" src="/main.js"></script>'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Vite (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents: ['<title>Vite App</title>', '<script type="module" src="/nested/base/dir/main.js"></script>'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'Vite (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<title>Vite App</title>', '<script type="module" src="/frontend/main.js"></script>'],
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-standalone',
    name: 'Vite SSR (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents: ['<title>Vite App</title>'],
    hmrTriggerFile: hmrTriggerFileSSR,
    language: 'js',
    additionalSetup: copyServerEntrypoint
  },
  {
    id: 'ssr-with-prefix',
    name: 'Vite SSR (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile: hmrTriggerFileSSR,
    language: 'js',
    additionalSetup: copyServerEntrypoint
  },
  {
    id: 'ssr-without-prefix',
    name: 'Vite SSR (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile: hmrTriggerFileSSR,
    language: 'js',
    additionalSetup: copyServerEntrypoint
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Vite SSR (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile: hmrTriggerFileSSR,
    language: 'js',
    additionalSetup: copyServerEntrypoint
  },
  {
    id: 'ssr-custom-commands',
    name: 'Vite SSR (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile: hmrTriggerFileSSR,
    language: 'js',
    additionalSetup: copyServerEntrypoint
  }
]

verifyDevelopmentMode(configurations, '', 'vite-hmr', websocketHMRHandler)
