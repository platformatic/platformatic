import { createDirectory, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import { symlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { before } from 'node:test'
import {
  setFixturesDir,
  temporaryFolder,
  verifyBuildAndProductionMode,
  verifyDevelopmentFrontendStandalone,
  verifyDevelopmentMode,
  verifyFrontendOnRoot
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const htmlContents = ['<body data-astro-source-file', /Hello from v\d+/]
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

async function linkAstro (version, root) {
  const modulesFolder = resolve(root, 'services/frontend/node_modules/astro')

  await safeRemove(modulesFolder)
  await symlink(resolve(temporaryFolder, `astro-${version}/node_modules/astro`), modulesFolder, 'dir')
}

function boundLinkAstro (version) {
  const fn = linkAstro.bind(null, version)
  fn.runAfterPrepare = true
  return fn
}

const versions = {
  5.7: '5.7.2',
  4.16: '4.16.18',
}

before(async () => {
  for (const [tag, version] of Object.entries(versions)) {
    const base = resolve(temporaryFolder, `astro-${tag}`)
    await safeRemove(base)
    await createDirectory(base)
    await writeFile(resolve(base, 'pnpm-workspace.yaml'), '')
    await execa('pnpm', ['add', '-D', '--ignore-workspace', `astro@${version}`], { cwd: base })
  }
})

const developmentConfigurations = [
  {
    id: 'compatibility',
    tag: '4.16.x',
    name: 'Astro (standalone) 4.16.x',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkAstro('4.16')
  },
  {
    id: 'compatibility',
    tag: '5.7.x',
    name: 'Astro (standalone) 5.7.x',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkAstro('5.7')
  },
  {
    id: 'ssr-standalone',
    tag: '4.16.x',
    name: 'Astro SSR (standalone) 4.16.x',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkAstro('4.16')
  },
  {
    id: 'ssr-standalone',
    tag: '5.7.x',
    name: 'Astro SSR (standalone) 5.7.x',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkAstro('5.7')
  }
]

const files = ['services/frontend/dist/index.html']

const productionConfigurations = [
  {
    id: 'standalone',
    tag: '4.16.x',
    name: 'Astro (standalone) 4.16.x',
    files,
    checks: [verifyFrontendOnRoot],
    language: 'js',
    prefix: '',
    additionalSetup: boundLinkAstro('4.16')
  },
  {
    id: 'standalone',
    tag: '5.7.x',
    name: 'Astro (standalone) 5.7.x',
    files,
    checks: [verifyFrontendOnRoot],
    language: 'js',
    prefix: '',
    additionalSetup: boundLinkAstro('5.7')
  }
]

verifyDevelopmentMode(developmentConfigurations, '', 'vite-hmr', websocketHMRHandler)

verifyBuildAndProductionMode(productionConfigurations)
