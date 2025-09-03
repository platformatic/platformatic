import { createDirectory, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { cp, symlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  internalApplicationsFiles,
  setFixturesDir,
  temporaryFolder,
  verifyBuildAndProductionMode,
  verifyDevelopmentFrontendWithPrefix,
  verifyDevelopmentMode,
  verifyFrontendAPIOnPrefix,
  verifyFrontendOnPrefix,
  verifyHTMLViaHTTP,
  verifyPlatformaticGateway,
  verifyPlatformaticService
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const viteVersions = ['5.4.0', '6.3.5']

const files = ['services/frontend/dist/index.html', 'services/frontend/dist/assets/index-*.js']
const filesSSR = ['services/frontend/client/dist/client/index.html', 'services/frontend/client/dist/server/index.js']
const htmlContents = ['<title>Vite App</title>', '<script type="module" src="/frontend/main.js"></script>']
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

async function verifyFrontendWithBundleOnPrefix (t, url) {
  const ssgContents = [
    '<title>Vite App</title>',
    /<script type="module" crossorigin src="\/frontend\/assets\/index-[a-z0-9-_]+.js"><\/script>/i
  ]

  await verifyHTMLViaHTTP(url, '/frontend', ssgContents)
  await verifyHTMLViaHTTP(url, '/frontend/', ssgContents)
}

async function linkVite (viteVersion, root) {
  const modulesFolder = resolve(root, 'services/frontend/node_modules/vite')

  await safeRemove(modulesFolder)
  await symlink(resolve(temporaryFolder, `vite-${viteVersion}/node_modules/vite`), modulesFolder, 'dir')

  await cp(resolve(import.meta.dirname, './fixtures/ssr-server.js'), resolve(root, 'services/frontend/server.js'))
}

async function installDependencies (viteVersion) {
  const base = resolve(temporaryFolder, `vite-${viteVersion}`)
  if (existsSync(base)) {
    return
  }

  await createDirectory(base)
  await writeFile(resolve(base, 'pnpm-workspace.yaml'), '')
  await execa('pnpm', ['add', '-D', '--ignore-workspace', `vite@${viteVersion}`], { cwd: base })
}

async function boundLinkVite (viteVersion) {
  await installDependencies(viteVersion)
  const fn = linkVite.bind(null, viteVersion)
  fn.runAfterPrepare = true
  return fn
}

async function generateConfigurations (bases) {
  const configs = []

  for (const vite of viteVersions) {
    for (const base of bases) {
      const tag = `Vite ${vite}`
      const additionalSetup = await boundLinkVite(vite)

      configs.push({ ...base, name: `${base.name} (${tag})`, tag, additionalSetup })
    }
  }

  return configs
}

async function run () {
  const developmentConfigurations = await generateConfigurations([
    {
      id: 'compatibility',
      name: 'Vite',
      check: verifyDevelopmentFrontendWithPrefix,
      htmlContents,
      hmrTriggerFile,
      language: 'js'
    },
    {
      id: 'compatibility-ssr',
      name: 'Vite SSR',
      check: verifyDevelopmentFrontendWithPrefix,
      htmlContents: htmlContentsSSR,
      hmrTriggerFile: hmrTriggerFileSSR,
      language: 'js'
    }
  ])

  verifyDevelopmentMode(developmentConfigurations, '', 'vite-hmr', websocketHMRHandler)

  const productionConfigurations = await generateConfigurations([
    {
      id: 'compatibility',
      name: 'Vite',
      files: [...files, ...internalApplicationsFiles],
      checks: [verifyFrontendWithBundleOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
      language: 'ts',
      prefix: '/frontend'
    },
    {
      id: 'compatibility-ssr',
      name: 'Vite SSR',
      files: filesSSR,
      checks: [verifyFrontendOnPrefix, verifyFrontendAPIOnPrefix, verifyPlatformaticGateway, verifyPlatformaticService],
      language: 'js',
      prefix: '/frontend'
    }
  ])

  verifyBuildAndProductionMode(productionConfigurations)
}

run()
