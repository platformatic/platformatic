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

const htmlContents = ['<body data-astro-source-file', /Hello from v\d+/]
const htmlContentsSSR = ['<body data-astro-source-file', /Hello from v\d+ t\d+/]
const hmrTriggerFile = 'services/frontend/src/pages/index.astro'

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
    name: 'Astro (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-with-prefix',
    name: 'Astro (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'ts'
  },
  {
    id: 'composer-without-prefix',
    name: 'Astro (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-autodetect-prefix',
    name: 'Astro (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'composer-custom-commands',
    name: 'Astro (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-standalone',
    name: 'Astro SSR (standalone)',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-with-prefix',
    name: 'Astro SSR (in composer with prefix)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-without-prefix',
    name: 'Astro SSR (in composer without prefix)',
    check: verifyDevelopmentFrontendWithoutPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-autodetect-prefix',
    name: 'Astro SSR (in composer with autodetected prefix)',
    check: verifyDevelopmentFrontendWithAutodetectPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  },
  {
    id: 'ssr-custom-commands',
    name: 'Astro SSR (in composer with prefix using custom commands)',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: htmlContentsSSR,
    hmrTriggerFile,
    language: 'js'
  }
]

verifyDevelopmentMode(configurations, '', 'vite-hmr', websocketHMRHandler)
