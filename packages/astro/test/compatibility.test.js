import { createDirectory, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import { symlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
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
  for (const mod of ['astro', 'vite']) {
    const modulesFolder = resolve(root, `services/frontend/node_modules/${mod}`)

    await safeRemove(modulesFolder)
    await createDirectory(dirname(modulesFolder))
    await symlink(resolve(temporaryFolder, `astro-${version}/node_modules/${mod}`), modulesFolder, 'dir')
  }
}

function boundLinkAstro (astroVersion, viteVersion) {
  const fn = linkAstro.bind(null, astroVersion, viteVersion)
  fn.runAfterPrepare = true
  return fn
}

const versions = {
  5.7: ['5.7.2', '6.3.5'],
  4.16: ['4.16.18', '5.4.0']
}

before(async () => {
  for (const [tag, [astroVersion, viteVersion]] of Object.entries(versions)) {
    const base = resolve(temporaryFolder, `astro-${tag}`)
    await safeRemove(base)
    await createDirectory(base)
    await writeFile(resolve(base, 'pnpm-workspace.yaml'), '')
    await execa('pnpm', ['add', '-D', '--ignore-workspace', `astro@${astroVersion}`, `vite@${viteVersion}`], {
      cwd: base
    })
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
    additionalSetup: boundLinkAstro('4.16', '5.4.0')
  },
  {
    id: 'compatibility',
    tag: '5.7.x',
    name: 'Astro (standalone) 5.7.x',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkAstro('5.7', '6.3.5')
  },
  {
    id: 'ssr-standalone',
    tag: '4.16.x',
    name: 'Astro SSR (standalone) 4.16.x',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkAstro('4.16', '5.4.0')
  },
  {
    id: 'ssr-standalone',
    tag: '5.7.x',
    name: 'Astro SSR (standalone) 5.7.x',
    check: verifyDevelopmentFrontendStandalone,
    htmlContents,
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkAstro('5.7', '6.3.5')
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
    additionalSetup: boundLinkAstro('4.16', '5.4.0')
  },
  {
    id: 'standalone',
    tag: '5.7.x',
    name: 'Astro (standalone) 5.7.x',
    files,
    checks: [verifyFrontendOnRoot],
    language: 'js',
    prefix: '',
    additionalSetup: boundLinkAstro('5.7', '6.3.5')
  }
]

verifyDevelopmentMode(developmentConfigurations, '', 'vite-hmr', websocketHMRHandler)

verifyBuildAndProductionMode(productionConfigurations)
