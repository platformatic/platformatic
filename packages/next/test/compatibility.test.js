import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { symlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { before } from 'node:test'
import {
  isCIOnWindows,
  setFixturesDir,
  temporaryFolder,
  verifyBuildAndProductionMode,
  verifyDevelopmentFrontendWithPrefix,
  verifyDevelopmentMode,
  verifyFrontendOnPrefix
} from '../../basic/test/helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const hmrTriggerFile = 'services/frontend/src/app/page.js'
const files = ['services/frontend/.next/server/app/index.html']

const versions = {
  '14.0': '14.0.0',
  14.1: '14.1.4',
  14.2: '14.2.18',
  15.0: '15.0.3'
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

async function linkNext (version, root) {
  for (const mod of ['next', 'react', 'react-dom']) {
    const modulesFolder = resolve(root, `services/frontend/node_modules/${mod}`)

    await safeRemove(modulesFolder)
    await symlink(resolve(temporaryFolder, `next-${version}/node_modules/${mod}`), modulesFolder, 'dir')
  }
}

function boundLinkNext (version) {
  const fn = linkNext.bind(null, version)
  fn.runAfterPrepare = true
  return fn
}

before(async () => {
  for (const [tag, version] of Object.entries(versions)) {
    const base = resolve(temporaryFolder, `next-${tag}`)
    await safeRemove(base)
    await createDirectory(base)
    await writeFile(resolve(base, 'pnpm-workspace.yaml'), '')
    await execa('pnpm', ['add', '-D', '--ignore-workspace', `next@${version}`, 'react', 'react-dom'], { cwd: base })
  }
})

const developmentConfigurations = [
  {
    id: 'compatibility',
    tag: '14.0.x',
    name: 'Next.js 14.0.x',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkNext('14.0')
  },
  {
    id: 'compatibility',
    tag: '14.1.x',
    name: 'Next.js 14.1.x',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkNext('14.1')
  },
  {
    id: 'compatibility',
    tag: '14.2.x',
    name: 'Next.js 14.2.x',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkNext('14.2')
  },
  {
    only: isCIOnWindows,
    id: 'compatibility',
    tag: '15.0.x',
    name: 'Next.js 15.0.x',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkNext('15.0')
  }
]

const productionConfigurations = [
  {
    id: 'compatibility',
    tag: '14.0.x',
    name: 'Next.js 14.0.x',
    prefix: '/frontend',
    files,
    checks: [verifyFrontendOnPrefix],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('14.0')
  },
  {
    id: 'compatibility',
    tag: '14.1.x',
    name: 'Next.js 14.1.x',
    prefix: '/frontend',
    files,
    checks: [verifyFrontendOnPrefix],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('14.1')
  },
  {
    id: 'compatibility',
    tag: '14.2.x',
    name: 'Next.js 14.2.x',
    prefix: '/frontend',
    files,
    checks: [verifyFrontendOnPrefix],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('14.2')
  },
  {
    id: 'compatibility',
    tag: '15.0.x',
    name: 'Next.js 15.0.x',
    prefix: '/frontend',
    files,
    checks: [verifyFrontendOnPrefix],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.0')
  }
]

verifyDevelopmentMode(developmentConfigurations, '_next/webpack-hmr', undefined, websocketHMRHandler)

if (!isCIOnWindows) {
  verifyBuildAndProductionMode(productionConfigurations)
}
