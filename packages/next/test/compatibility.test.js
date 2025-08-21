import { createDirectory, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import { deepStrictEqual } from 'node:assert'
import { existsSync } from 'node:fs'
import { symlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { request } from 'undici'
import {
  createRuntime,
  setFixturesDir,
  temporaryFolder,
  verifyBuildAndProductionMode,
  verifyDevelopmentFrontendWithPrefix,
  verifyDevelopmentMode,
  verifyFrontendOnPrefix
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function verifyMiddlewareContext (t, url) {
  const { statusCode, body } = await request(url)
  deepStrictEqual(statusCode, 200)

  const data = await body.text()
  deepStrictEqual(
    data,
    JSON.stringify({
      success: true,
      message: 'middleware',
      status: 200,
      data: {
        hello: 'world',
        intercepted: true
      }
    })
  )
}

async function verifyDevelopmentMiddlewareContext (t, configuration) {
  const { url } = await createRuntime(t, configuration)
  await verifyMiddlewareContext(t, url)
}

const hmrTriggerFile = 'services/frontend/src/app/page.js'
const files = ['services/frontend/.next/server/app/index.html']

const NEXT_VERSION_14_0 = '14.0.0'
const NEXT_VERSION_14_1 = '14.1.4'
const NEXT_VERSION_14_2 = '14.2.18'
const NEXT_VERSION_15_0 = '15.0.3'
const NEXT_VERSION_15_1 = '15.1.3'

const REACT_VERSION_18_0 = '18.0.0'
const REACT_VERSION_19_1 = '19.1.0'

const reactVersions = {
  [NEXT_VERSION_14_0]: [REACT_VERSION_18_0],
  [NEXT_VERSION_14_1]: [REACT_VERSION_18_0],
  [NEXT_VERSION_14_2]: [REACT_VERSION_18_0],
  [NEXT_VERSION_15_0]: [REACT_VERSION_18_0, REACT_VERSION_19_1],
  [NEXT_VERSION_15_1]: [REACT_VERSION_18_0, REACT_VERSION_19_1]
}

function websocketHMRHandler (message, resolveConnection, resolveReload) {
  switch (message.action) {
    case 'sync':
      resolveConnection()
      break
    case 'serverComponentChanges':
      resolveReload()
  }
}

async function linkNext (nextVersion, reactVersion, root) {
  for (const mod of ['next', 'react', 'react-dom']) {
    const modulesFolder = resolve(root, `services/frontend/node_modules/${mod}`)

    await safeRemove(modulesFolder)
    await symlink(
      resolve(temporaryFolder, `next-${nextVersion}-${reactVersion}/node_modules/${mod}`),
      modulesFolder,
      'dir'
    )
  }
}

async function boundLinkNext (nextVersion, reactVersion) {
  await installDependencies(nextVersion, reactVersion)
  const fn = linkNext.bind(null, nextVersion, reactVersion)
  fn.runAfterPrepare = true
  return fn
}

async function installDependencies (nextVersion, reactVersion) {
  const base = resolve(temporaryFolder, `next-${nextVersion}-${reactVersion}`)
  if (existsSync(base)) {
    return
  }
  await createDirectory(base)
  await writeFile(resolve(base, 'pnpm-workspace.yaml'), '')
  await execa(
    'pnpm',
    ['add', '-D', '--ignore-workspace', `next@${nextVersion}`, `react@${reactVersion}`, `react-dom@${reactVersion}`],
    { cwd: base }
  )
}

async function combine (nextVersions, configuration) {
  const configurations = []
  for (const nextVersion of nextVersions) {
    for (const reactVersion of reactVersions[nextVersion]) {
      configurations.push({
        ...configuration,
        tag: `next@${nextVersion} react@${reactVersion}`,
        name: `Next.js ${nextVersion} React ${reactVersion}`,
        additionalSetup: await boundLinkNext(nextVersion, reactVersion)
      })
    }
  }
  return configurations
}

async function run () {
  const developmentConfigurations = [
    ...(await combine([NEXT_VERSION_14_0, NEXT_VERSION_14_1, NEXT_VERSION_14_2, NEXT_VERSION_15_0, NEXT_VERSION_15_1], {
      id: 'compatibility',
      check: verifyDevelopmentFrontendWithPrefix,
      htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
      hmrTriggerFile,
      language: 'js'
    })),
    ...(await combine([NEXT_VERSION_14_2, NEXT_VERSION_15_0, NEXT_VERSION_15_1], {
      id: 'middleware',
      files,
      check: verifyDevelopmentMiddlewareContext,
      htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
      language: 'js'
    }))
  ]

  verifyDevelopmentMode(developmentConfigurations, '_next/webpack-hmr', undefined, websocketHMRHandler)

  const productionConfigurations = [
    ...(await combine([NEXT_VERSION_14_0, NEXT_VERSION_14_1, NEXT_VERSION_14_2, NEXT_VERSION_15_0, NEXT_VERSION_15_1], {
      id: 'compatibility',
      prefix: '/frontend',
      files,
      checks: [verifyFrontendOnPrefix],
      htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
      language: 'js'
    })),
    ...(await combine([NEXT_VERSION_14_2, NEXT_VERSION_15_0, NEXT_VERSION_15_1], {
      id: 'middleware',
      files,
      checks: [verifyMiddlewareContext],
      htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
      language: 'js'
    }))
  ]

  verifyBuildAndProductionMode(productionConfigurations)
}

run()
