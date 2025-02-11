import { deepStrictEqual } from 'node:assert'
import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { symlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { before } from 'node:test'
import { request } from 'undici'
import {
  isCIOnWindows,
  setFixturesDir,
  temporaryFolder,
  createRuntime,
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
  deepStrictEqual(data, JSON.stringify({
    success: true,
    message: 'middleware',
    status: 200,
    data: {
      hello: 'world',
      intercepted: true
    }
  }))
}

async function verifyDevelopmentMiddlewareContext (t, configuration) {
  const { url } = await createRuntime(t, configuration)
  await verifyMiddlewareContext(t, url)
}

const hmrTriggerFile = 'services/frontend/src/app/page.js'
const files = ['services/frontend/.next/server/app/index.html']

const versions = {
  '14.0': '14.0.0',
  14.1: '14.1.4',
  14.2: '14.2.18',
  15.0: '15.0.3',
  15.1: '15.1.3'
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
    skip: isCIOnWindows,
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
    skip: isCIOnWindows,
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
    skip: isCIOnWindows,
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
    skip: isCIOnWindows,
    id: 'compatibility',
    tag: '15.0.x',
    name: 'Next.js 15.0.x',
    check: verifyDevelopmentFrontendWithPrefix,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    hmrTriggerFile,
    language: 'js',
    additionalSetup: boundLinkNext('15.0')
  },
  {
    id: 'middleware',
    skip: isCIOnWindows,
    tag: '14.2.x',
    name: 'Next.js 14.2.x',
    files,
    check: verifyDevelopmentMiddlewareContext,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('14.2')
  },
  {
    id: 'middleware',
    skip: isCIOnWindows,
    tag: '15.0.x',
    name: 'Next.js 15.0.x',
    files,
    check: verifyDevelopmentMiddlewareContext,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.0')
  },
  {
    id: 'middleware',
    skip: isCIOnWindows,
    tag: '15.1.x',
    name: 'Next.js 15.1.x',
    files,
    check: verifyDevelopmentMiddlewareContext,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.1')
  },
  {
    id: 'middleware-child-process',
    skip: isCIOnWindows,
    tag: '14.2.x',
    name: 'Next.js 14.2.x',
    files,
    check: verifyDevelopmentMiddlewareContext,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('14.2')
  },
  {
    id: 'middleware-child-process',
    skip: isCIOnWindows,
    tag: '15.0.x',
    name: 'Next.js 15.0.x',
    files,
    check: verifyDevelopmentMiddlewareContext,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.0')
  },
  {
    id: 'middleware-child-process',
    skip: isCIOnWindows,
    tag: '15.1.x',
    name: 'Next.js 15.1.x',
    files,
    check: verifyDevelopmentMiddlewareContext,
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.1')
  }
]

const productionConfigurations = [
  {
    id: 'compatibility',
    skip: isCIOnWindows,
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
    skip: isCIOnWindows,
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
    skip: isCIOnWindows,
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
    skip: isCIOnWindows,
    tag: '15.0.x',
    name: 'Next.js 15.0.x',
    prefix: '/frontend',
    files,
    checks: [verifyFrontendOnPrefix],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.0')
  },
  {
    id: 'middleware',
    skip: isCIOnWindows,
    tag: '14.2.x',
    name: 'Next.js 14.2.x',
    files,
    checks: [verifyMiddlewareContext],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('14.2')
  },
  {
    id: 'middleware',
    skip: isCIOnWindows,
    tag: '15.0.x',
    name: 'Next.js 15.0.x',
    files,
    checks: [verifyMiddlewareContext],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.0')
  },
  {
    id: 'middleware',
    skip: isCIOnWindows,
    tag: '15.1.x',
    name: 'Next.js 15.1.x',
    files,
    checks: [verifyMiddlewareContext],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.1')
  },
  {
    id: 'middleware-child-process',
    skip: isCIOnWindows,
    tag: '14.2.x',
    name: 'Next.js 14.2.x',
    files,
    checks: [verifyMiddlewareContext],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('14.2')
  },
  {
    id: 'middleware-child-process',
    skip: isCIOnWindows,
    tag: '15.0.x',
    name: 'Next.js 15.0.x',
    files,
    checks: [verifyMiddlewareContext],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.0')
  },
  {
    id: 'middleware-child-process',
    skip: isCIOnWindows,
    tag: '15.1.x',
    name: 'Next.js 15.1.x',
    files,
    checks: [verifyMiddlewareContext],
    htmlContents: ['<script src="/frontend/_next/static/chunks/main-app.js'],
    language: 'js',
    additionalSetup: boundLinkNext('15.1')
  }
]

verifyDevelopmentMode(developmentConfigurations, '_next/webpack-hmr', undefined, websocketHMRHandler)

verifyBuildAndProductionMode(productionConfigurations)
