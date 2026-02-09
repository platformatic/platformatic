import { equal, ok, rejects } from 'node:assert'
import { mkdir, mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { MockAgent, setGlobalDispatcher } from 'undici'
import {
  detectApplicationType,
  getInstallationCommand,
  getLatestNpmVersion,
  getPackageManager,
  getPkgManager,
  getPlatformaticVersion,
  hasDependency,
  kFailedImport,
  loadModule,
  splitModuleFromVersion
} from '../index.js'

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

test('getPlatformaticVersion', async t => {
  const version = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version
  const platformaticVersion = await getPlatformaticVersion()
  equal(platformaticVersion, version)
})

test('getPlatformaticVersion - should return cached version on second call', async t => {
  const firstCall = await getPlatformaticVersion()
  const secondCall = await getPlatformaticVersion()
  equal(firstCall, secondCall)
})

test('hasDependency', async t => {
  ok(hasDependency({ dependencies: { fastify: '1.0.0' } }, 'fastify'), 'has dependency')
  ok(!hasDependency({ dependencies: { express: '1.0.0' } }, 'fastify'), 'does not have dependency')
  ok(hasDependency({ devDependencies: { fastify: '1.0.0' } }, 'fastify'), 'has dev dependency')
})

test('getLatestNpmVersion', async t => {
  {
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: '/foobar'
      })
      .reply(200, {
        'dist-tags': {
          latest: '1.2.3'
        }
      })
    const latest = await getLatestNpmVersion('foobar')
    equal(latest, '1.2.3')
  }
  {
    // returns null
    mockAgent
      .get('https://registry.npmjs.org')
      .intercept({
        method: 'GET',
        path: '/foobar'
      })
      .reply(404, {})

    const latest = await getLatestNpmVersion('foobar')
    equal(latest, null)
  }
})

test('getPkgManager - detects npm', async t => {
  process.env.npm_config_user_agent = 'npm/7.18.1 node/v16.4.2 darwin x64'

  t.after(() => {
    delete process.env.npm_config_user_agent
  })

  equal(getPkgManager(), 'npm')
})

test('getPkgManager - detects yarn', async t => {
  process.env.npm_config_user_agent = 'yarn/1.22.10 npm/? node/v16.4.2 darwin x64'

  t.after(() => {
    delete process.env.npm_config_user_agent
  })

  equal(getPkgManager(), 'yarn')
})

test('getPkgManager - detects pnpm', async t => {
  process.env.npm_config_user_agent = 'pnpm/6.14.1 npm/? node/v16.4.2 darwin x64'

  t.after(() => {
    delete process.env.npm_config_user_agent
  })

  equal(getPkgManager(), 'pnpm')
})

test('getPkgManager - detects cnpm', async t => {
  process.env.npm_config_user_agent = 'cnpm/7.0.0 npminsall/1.0.0 node/v16.4.2 darwin x64'

  t.after(() => {
    delete process.env.npm_config_user_agent
  })

  equal(getPkgManager(), 'cnpm')
})

test('getPkgManager - defaults to npm if the user agent is unknown', async t => {
  process.env.npm_config_user_agent = 'xxxxxxxxxxxxxxxxxx'

  t.after(() => {
    delete process.env.npm_config_user_agent
  })

  equal(getPkgManager(), 'npm')
})

test('getPkgManager - defaults to npm if the user agent is not set', async t => {
  delete process.env.npm_config_user_agent

  t.after(() => {
    delete process.env.npm_config_user_agent
  })

  equal(getPkgManager(), 'npm')
})

test('getPackageManager', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'wattpm-tests-'))
  equal(await getPackageManager('wrong'), 'npm', 'default to npmawait ')

  // from package-lock.json
  await writeFile(join(tmpDir, 'package-lock.json'), '.', 'utf-8')
  equal(await getPackageManager(tmpDir), 'npm', 'found package-lock.json file')
  await await unlink(join(tmpDir, 'package-lock.json'))

  // from yarn.lock
  const tmpYarnFile = join(tmpDir, 'yarn.lock')
  await writeFile(tmpYarnFile, '-')
  equal(await getPackageManager(tmpDir), 'yarn', 'found yarn.lock file')
  await await unlink(tmpYarnFile)

  // from pnpm-lock.yaml
  const tmpPnpmFile = join(tmpDir, 'pnpm-lock.yaml')
  await writeFile(tmpPnpmFile, '-')
  equal(await getPackageManager(tmpDir), 'pnpm', 'found pnpm-lock.yaml file')
  await await unlink(tmpPnpmFile)

  equal(await getPackageManager(tmpDir), 'npm', 'no lock files, default to npmawait ')

  await rmdir(tmpDir)
})

test('getPackageManager - search functionality', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'wattpm-tests-'))
  const subDir = join(tmpDir, 'subdir')
  await mkdir(subDir)

  // Create lock file in subdirectory
  await writeFile(join(subDir, 'pnpm-lock.yaml'), '-')

  // Search should find the lock file in subdirectory
  equal(await getPackageManager(tmpDir, 'npm', true), 'pnpm', 'found pnpm-lock.yaml in subdirectory')

  await unlink(join(subDir, 'pnpm-lock.yaml'))
  await rmdir(subDir)
  await rmdir(tmpDir)
})

test('getPackageManager - search functionality with no package manager found', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'wattpm-tests-'))
  const subDir = join(tmpDir, 'subdir')
  await mkdir(subDir)

  // No lock files in subdirectory, should return default manager
  equal(await getPackageManager(tmpDir, 'yarn', true), 'yarn', 'no lock files found, return default')

  await rmdir(subDir)
  await rmdir(tmpDir)
})

test('getInstallationCommand - default install command', () => {
  equal(JSON.stringify(getInstallationCommand('npm', false)), JSON.stringify(['install']))
  equal(JSON.stringify(getInstallationCommand('yarn', false)), JSON.stringify(['install']))
  equal(JSON.stringify(getInstallationCommand('pnpm', false)), JSON.stringify(['install']))
})

test('getInstallationCommand - production install commands', () => {
  equal(JSON.stringify(getInstallationCommand('npm', true)), JSON.stringify(['install', '--omit=dev']))
  equal(JSON.stringify(getInstallationCommand('yarn', true)), JSON.stringify(['install', '--production']))
  equal(JSON.stringify(getInstallationCommand('pnpm', true)), JSON.stringify(['install', '--prod']))
})

test('splitModuleFromVersion - should return empty object for falsy module', async t => {
  equal(JSON.stringify(splitModuleFromVersion()), JSON.stringify({}))
  equal(JSON.stringify(splitModuleFromVersion(null)), JSON.stringify({}))
  equal(JSON.stringify(splitModuleFromVersion('')), JSON.stringify({}))
  equal(JSON.stringify(splitModuleFromVersion(undefined)), JSON.stringify({}))
})

test('splitModuleFromVersion - should split module and version', async t => {
  const result = splitModuleFromVersion('express@4.18.2')
  equal(result.module, 'express')
  equal(result.version, '4.18.2')
})

test('splitModuleFromVersion - should handle module without version', async t => {
  const result = splitModuleFromVersion('express')
  equal(result.module, 'express')
  equal(result.version, undefined)
})

test('splitModuleFromVersion - should handle scoped packages with version', async t => {
  const result = splitModuleFromVersion('@fastify/helmet@10.1.1')
  equal(result.module, '@fastify/helmet')
  equal(result.version, '10.1.1')
})

test('splitModuleFromVersion - should handle scoped packages without version', async t => {
  const result = splitModuleFromVersion('@fastify/helmet')
  equal(result.module, '@fastify/helmet')
  equal(result.version, undefined)
})

test('detectApplicationType - should detect NestJS', async t => {
  const packageJson = { dependencies: { '@nestjs/core': '^8.0.0' } }
  const result = await detectApplicationType('/tmp', packageJson)
  equal(result.name, '@platformatic/nest')
  equal(result.label, 'NestJS')
})

test('detectApplicationType - should detect Next.js', async t => {
  const packageJson = { dependencies: { next: '^12.0.0' } }
  const result = await detectApplicationType('/tmp', packageJson)
  equal(result.name, '@platformatic/next')
  equal(result.label, 'Next.js')
})

test('detectApplicationType - should detect Remix', async t => {
  const packageJson = { devDependencies: { '@remix-run/dev': '^1.0.0' } }
  const result = await detectApplicationType('/tmp', packageJson)
  equal(result.name, '@platformatic/remix')
  equal(result.label, 'Remix')
})

test('detectApplicationType - should detect Astro', async t => {
  const packageJson = { dependencies: { astro: '^1.0.0' } }
  const result = await detectApplicationType('/tmp', packageJson)
  equal(result.name, '@platformatic/astro')
  equal(result.label, 'Astro')
})

test('detectApplicationType - should detect Vite', async t => {
  const packageJson = { devDependencies: { vite: '^3.0.0' } }
  const result = await detectApplicationType('/tmp', packageJson)
  equal(result.name, '@platformatic/vite')
  equal(result.label, 'Vite')
})

test('detectApplicationType - should detect Node.js when has JS files', async t => {
  const tempDir = join(tmpdir(), 'test-' + Math.random().toString(36).substr(2, 9))
  await mkdir(tempDir, { recursive: true })

  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
  })

  // Create a JS file
  await writeFile(join(tempDir, 'index.js'), 'console.log("hello")')

  const packageJson = { dependencies: {} }
  const result = await detectApplicationType(tempDir, packageJson)
  equal(result.name, '@platformatic/node')
  equal(result.label, 'Node.js')
})

test('detectApplicationType - should return null when no framework detected and no JS files', async t => {
  const tempDir = join(tmpdir(), 'test-' + Math.random().toString(36).substr(2, 9))
  await mkdir(tempDir, { recursive: true })

  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
  })

  const packageJson = { dependencies: {} }
  const result = await detectApplicationType(tempDir, packageJson)
  equal(result, null)
})

test('detectApplicationType - should read package.json from root when not provided', async t => {
  const tempDir = join(tmpdir(), 'test-' + Math.random().toString(36).substr(2, 9))
  await mkdir(tempDir, { recursive: true })

  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
  })

  // Create package.json with Next.js dependency
  await writeFile(join(tempDir, 'package.json'), JSON.stringify({ dependencies: { next: '^12.0.0' } }))

  const result = await detectApplicationType(tempDir)
  equal(result.name, '@platformatic/next')
  equal(result.label, 'Next.js')
})

test('detectApplicationType - should handle missing package.json gracefully', async t => {
  const tempDir = join(tmpdir(), 'test-' + Math.random().toString(36).substr(2, 9))
  await mkdir(tempDir, { recursive: true })

  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
  })

  const result = await detectApplicationType(tempDir)
  equal(result, null)
})

test('loadModule - should load CommonJS module', async t => {
  const tempDir = join(tmpdir(), 'test-' + Math.random().toString(36).substr(2, 9))
  await mkdir(tempDir, { recursive: true })

  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
  })

  const modulePath = join(tempDir, 'test-module.js')
  await writeFile(modulePath, 'module.exports = { test: "value" }')

  const require = createRequire(import.meta.url)
  const result = await loadModule(require, modulePath)
  equal(result.test, 'value')
})

test('loadModule - should load ESM module when require fails with ERR_REQUIRE_ESM', async t => {
  const tempDir = join(tmpdir(), 'test-' + Math.random().toString(36).substr(2, 9))
  await mkdir(tempDir, { recursive: true })

  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
  })

  // Create package.json to make this an ES module
  await writeFile(join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }))

  const modulePath = join(tempDir, 'test-module.js')
  await writeFile(modulePath, 'export default { test: "esm-value" }')

  const require = createRequire(import.meta.url)
  const result = await loadModule(require, modulePath)
  equal(result.test, 'esm-value')
})

test('loadModule - should handle file:// URLs', async t => {
  const tempDir = join(tmpdir(), 'test-' + Math.random().toString(36).substr(2, 9))
  await mkdir(tempDir, { recursive: true })

  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
  })

  const modulePath = join(tempDir, 'test-module.js')
  await writeFile(modulePath, 'module.exports = { test: "file-url-value" }')

  const require = createRequire(import.meta.url)
  const fileUrl = 'file://' + modulePath
  const result = await loadModule(require, fileUrl)
  equal(result.test, 'file-url-value')
})

test('loadModule - should throw with kFailedImport symbol for module not found', async t => {
  const require = createRequire(import.meta.url)
  const nonExistentPath = '/non/existent/module'

  await rejects(
    () => loadModule(require, nonExistentPath),
    err => {
      ok(err[kFailedImport] === nonExistentPath)
      return true
    }
  )
})

test('loadModule - should throw for other errors', async t => {
  const tempDir = join(tmpdir(), 'test-' + Math.random().toString(36).substr(2, 9))
  await mkdir(tempDir, { recursive: true })

  t.after(async () => {
    await import('node:fs/promises').then(fs => fs.rm(tempDir, { recursive: true, force: true }))
  })

  const modulePath = join(tempDir, 'broken-module.js')
  await writeFile(modulePath, 'throw new Error("broken module")')

  const require = createRequire(import.meta.url)
  await rejects(() => loadModule(require, modulePath), /broken module/)
})
