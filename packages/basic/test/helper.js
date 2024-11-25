import { createDirectory, safeRemove, withResolvers } from '@platformatic/utils'
import { join } from 'desm'
import { execa } from 'execa'
import { minimatch } from 'minimatch'
import { deepStrictEqual, fail, ok, strictEqual } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, readdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { platform } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { Client, request } from 'undici'
import WebSocket from 'ws'
import { loadConfig } from '../../config/index.js'
import { buildServer, platformaticRuntime } from '../../runtime/index.js'
import { BaseStackable } from '../lib/base.js'

export { setTimeout as sleep } from 'node:timers/promises'

const HMR_TIMEOUT = process.env.CI ? 20000 : 10000
const DEFAULT_PAUSE_TIMEOUT = 300000
const htmlHelloMatcher = /Hello from (v(<!-- -->)?\d+)(\s*(t(<!-- -->)?\d+))?/

let currentWorkingDirectory
let hmrTriggerFileRelative
let additionalDependencies

export let fixturesDir

export const isWindows = platform() === 'win32'
export const isCIOnWindows = process.env.CI && isWindows
export const cliPath = join(import.meta.url, '../../cli', 'cli.js')
export const pltRoot = fileURLToPath(new URL('../../..', import.meta.url))
export const temporaryFolder = fileURLToPath(new URL('../../../tmp', import.meta.url))
export const commonFixturesRoot = fileURLToPath(new URL('./fixtures/common', import.meta.url))

// These come from @platformatic/service, where they are not listed explicitly inside services
export const defaultDependencies = ['fastify', 'typescript']

export const internalServicesFiles = [
  'services/composer/dist/plugins/example.js',
  'services/composer/dist/routes/root.js',
  'services/backend/dist/plugins/example.js',
  'services/backend/dist/routes/root.js'
]

export async function createStackable (
  t,
  context = {},
  config = { current: {} },
  name = 'base',
  version = '1.0.0',
  base = temporaryFolder
) {
  await createDirectory(base)
  t.after(() => safeRemove(base))

  return new BaseStackable(name, version, { context }, base, config)
}

export function createMockedLogger () {
  const messages = []

  const logger = {
    debug (message) {
      messages.push(['DEBUG', message])
    },
    info (message) {
      messages.push(['INFO', message])
    },
    error (message) {
      messages.push(['ERROR', message])
    }
  }

  return { logger, messages }
}

export function setFixturesDir (directory) {
  fixturesDir = directory
}

export function setHMRTriggerFile (file) {
  hmrTriggerFileRelative = file
}

export function setAdditionalDependencies (dependencies) {
  additionalDependencies = dependencies
}

// This is used to debug tests
export function pause (t, url, root, timeout) {
  if (timeout && typeof timeout !== 'number') {
    timeout = DEFAULT_PAUSE_TIMEOUT
  }

  console.log(
    `--- Pausing on test "${t.name}" - Server is listening at ${url.replace('[::]', '127.0.0.1')} (located at ${root}). Press any key to resume ...`
  )

  return new Promise(resolve => {
    let handler = null

    function listener () {
      console.log('--- Resuming execution ...')
      clearTimeout(handler)
      process.stdin.removeListener('data', listener)
      resolve()
    }

    handler = setTimeout(listener, timeout)
    process.stdin.on('data', listener)
  })
}

export async function updateFile (path, update) {
  const contents = await readFile(path, 'utf-8')
  await writeFile(path, await update(contents), 'utf-8')
}

export async function ensureDependencies (config) {
  const paths = [config.configManager.dirname, ...config.configManager.current.services.map(s => s.path)]
  const require = createRequire(import.meta.url)

  // Make sure dependencies are symlinked
  for (const path of paths) {
    const binFolder = resolve(path, 'node_modules/.bin')
    await createDirectory(binFolder)

    // Parse all dependencies from the package.json
    const { dependencies, devDependencies } = existsSync(resolve(path, 'package.json'))
      ? JSON.parse(await readFile(resolve(path, 'package.json'), 'utf-8'))
      : {}

    // Compute all dependencies
    const allDeps = Array.from(
      new Set([
        ...Object.keys(dependencies ?? {}),
        ...Object.keys(devDependencies ?? {}),
        ...(defaultDependencies ?? []),
        ...(additionalDependencies ?? [])
      ])
    )

    for (const dep of allDeps) {
      if (dep === 'platformatic') {
        continue
      }

      const moduleRoot = resolve(path, 'node_modules', dep)

      // If it is a @platformatic dependency, use the current repository, otherwise resolve
      let resolved = resolve(pltRoot, 'node_modules', dep)

      if (!existsSync(resolved)) {
        resolved =
          dep.startsWith('@platformatic') || dep === 'wattpm'
            ? resolve(pltRoot, `packages/${dep.replace('@platformatic/', '')}`)
            : require.resolve(dep)
      }

      // Some packages mistakenly insert package.json in the dist folder, force a resolving
      if (dirname(resolved).endsWith('dist')) {
        resolved = resolve(dirname(resolved), '..')
      }

      // If not in the package root, let's find it
      while (!existsSync(resolve(resolved, 'package.json'))) {
        resolved = dirname(resolved)

        // Fallback to the current repository when nothing could be found
        if (resolved === '/') {
          resolved = pltRoot
          break
        }
      }

      // Create the subfolder if needed
      if (dep.includes('/')) {
        await createDirectory(resolve(path, 'node_modules', dirname(dep)))
      }

      // Symlink the dependency
      await symlink(resolved, moduleRoot, 'dir')

      // Now link all the binaries
      const { bin } = JSON.parse(await readFile(resolve(moduleRoot, 'package.json'), 'utf-8'))

      for (const [name, destination] of Object.entries(bin ?? {})) {
        await symlink(resolve(moduleRoot, destination), resolve(binFolder, name), 'file')

        // Fix for NPM on Windows
        if (isWindows) {
          await symlink(resolve(pltRoot, 'node_modules/.bin', `${name}.ps1`), resolve(binFolder, `${name}.ps1`), 'file')
          await symlink(resolve(pltRoot, 'node_modules/.bin', `${name}.cmd`), resolve(binFolder, `${name}.cmd`), 'file')
        }
      }
    }
  }
}

export async function prepareRuntime (t, fixturePath, production, configFile, additionalSetup) {
  production ??= false
  configFile ??= 'platformatic.runtime.json'

  const root = resolve(temporaryFolder, basename(fixturePath) + '-' + Date.now())
  currentWorkingDirectory = root

  await createDirectory(root)

  // Copy the fixtures
  await cp(resolve(fixturesDir, fixturePath), root, { recursive: true })

  // Init the runtime
  const args = ['-c', resolve(root, configFile)]

  if (production) {
    args.push('--production')
  }

  const config = await loadConfig({}, args, platformaticRuntime)

  await additionalSetup?.(root, config, args)
  // Ensure the dependencies
  await ensureDependencies(config)

  return { root, config, args }
}

export async function startRuntime (t, root, config, pauseAfterCreation = false, servicesToBuild = false) {
  const originalCwd = process.cwd()

  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  if (Array.isArray(servicesToBuild)) {
    for (const service of servicesToBuild) {
      await runtime.buildService(service)
    }
  }

  const url = await runtime.start()

  t.after(async () => {
    process.chdir(originalCwd)
    await runtime.close()
    await safeRemove(root)
  })

  if (pauseAfterCreation) {
    await pause(t, url, root, pauseAfterCreation)
  }

  return { runtime, url, root }
}

export async function createRuntime (
  t,
  fixturePath,
  pauseAfterCreation = false,
  production = false,
  configFile = 'platformatic.runtime.json'
) {
  const { root, config } = await prepareRuntime(t, fixturePath, production, configFile)

  return startRuntime(t, root, config, pauseAfterCreation)
}

export async function createProductionRuntime (
  t,
  fixturePath,
  pauseAfterCreation = false,
  configFile = 'platformatic.runtime.json'
) {
  return createRuntime(t, fixturePath, pauseAfterCreation, true, configFile)
}

export async function getLogs (app) {
  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  // Wait for logs to be written
  await sleep(3000)

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/logs/all'
  })

  strictEqual(statusCode, 200)

  const rawLogs = await body.text()

  return rawLogs
    .trim()
    .split('\n')
    .filter(l => l)
    .map(m => JSON.parse(m))
}

export async function verifyJSONViaHTTP (baseUrl, path, expectedCode, expectedContent) {
  const { statusCode, body } = await request(baseUrl + path, { maxRedirections: 1 })
  strictEqual(statusCode, expectedCode)

  if (typeof expectedContent === 'function') {
    return expectedContent(await body.json())
  }

  deepStrictEqual(await body.json(), expectedContent)
}

export async function verifyJSONViaInject (app, serviceId, method, url, expectedCode, expectedContent) {
  const { statusCode, body } = await app.inject(serviceId, { method, url })
  strictEqual(statusCode, expectedCode)

  if (typeof expectedContent === 'function') {
    return expectedContent(JSON.parse(body))
  }

  deepStrictEqual(JSON.parse(body), expectedContent)
}

export async function verifyHTMLViaHTTP (baseUrl, path, contents) {
  const { statusCode, headers, body } = await request(baseUrl + path, { maxRedirections: 1 })
  const html = await body.text()

  deepStrictEqual(statusCode, 200)
  ok(headers['content-type']?.startsWith('text/html'))

  if (typeof contents === 'function') {
    return contents(html)
  }

  for (const content of contents) {
    ok(content instanceof RegExp ? content.test(html) : html.includes(content), content)
  }
}

export async function verifyHTMLViaInject (app, serviceId, url, contents) {
  const { statusCode, headers, body: html } = await app.inject(serviceId, { method: 'GET', url })

  if (statusCode === 308) {
    return app.inject(serviceId, { method: 'GET', url: headers.location })
  }

  deepStrictEqual(statusCode, 200)
  ok(headers['content-type'].startsWith('text/html'))

  if (typeof contents === 'function') {
    return contents(html)
  }

  for (const content of contents) {
    ok(content instanceof RegExp ? content.test(html) : html.includes(content), content)
  }
}

export async function verifyHMR (baseUrl, path, protocol, handler) {
  const connection = withResolvers()
  const reload = withResolvers()
  const ac = new AbortController()
  const timeout = sleep(HMR_TIMEOUT, 'timeout', { signal: ac.signal })

  const url = baseUrl.replace('http:', 'ws:') + path
  const webSocket = new WebSocket(url, protocol)

  webSocket.on('error', err => {
    clearTimeout(timeout)
    connection.reject(err)
    reload.reject(err)
  })

  webSocket.on('message', data => {
    handler(JSON.parse(data), connection.resolve, reload.resolve)
  })

  const hmrTriggerFile = resolve(currentWorkingDirectory, hmrTriggerFileRelative)
  const originalContents = await readFile(hmrTriggerFile, 'utf-8')
  try {
    if ((await Promise.race([connection.promise, timeout])) === 'timeout') {
      throw new Error('Timeout while waiting for HMR connection')
    }

    await sleep(500)
    await writeFile(hmrTriggerFile, originalContents.replace('const version = 123', 'const version = 456'), 'utf-8')

    if ((await Promise.race([reload.promise, timeout])) === 'timeout') {
      throw new Error('Timeout while waiting for HMR reload')
    }
  } finally {
    webSocket.terminate()
    ac.abort()
    await writeFile(hmrTriggerFile, originalContents, 'utf-8')
  }
}

async function ensureExists (path) {
  const directory = dirname(path)
  const pattern = basename(path)

  let existing = []
  try {
    existing = await readdir(directory)

    if (existing.length === 0) {
      throw new Error('EMPTY')
    }
  } catch (e) {
    fail(`Directory ${directory} does not exist or is empty.`)
    // No-op
  }

  ok(
    existing.some(e => minimatch(e, pattern)),
    `Pattern ${path} not found.`
  )
}

export function verifyPlatformaticComposer (t, url) {
  return verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
}

export function verifyPlatformaticComposerWithProxy (t, url) {
  return verifyJSONViaHTTP(url, '/external-proxy/example', 200, { hello: 'foobar' })
}

export async function verifyPlatformaticService (t, url) {
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/time', 200, body => {
    ok(typeof body.time === 'number')
  })
}

export async function verifyPlatformaticServiceWithProxy (t, url) {
  await verifyJSONViaHTTP(url, '/external-proxy/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/external-proxy/backend/time', 200, body => {
    ok(typeof body.time === 'number')
  })
}

export async function verifyPlatformaticDB (t, url) {
  await verifyJSONViaHTTP(url, '/db/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/db/movies/', 200, [])
}

export async function verifyFrontendOnRoot (t, url) {
  await verifyHTMLViaHTTP(url, '/', [htmlHelloMatcher])
}

export async function verifyFrontendOnPrefix (t, url) {
  await verifyHTMLViaHTTP(url, '/frontend', [htmlHelloMatcher])
  await verifyHTMLViaHTTP(url, '/frontend/', [htmlHelloMatcher])
}

export async function verifyFrontendOnPrefixWithProxy (t, url) {
  await verifyHTMLViaHTTP(url, '/external-proxy/frontend', [htmlHelloMatcher])
  await verifyHTMLViaHTTP(url, '/external-proxy/frontend/', [htmlHelloMatcher])
}

export async function verifyFrontendOnAutodetectedPrefix (t, url) {
  await verifyHTMLViaHTTP(url, '/nested/base/dir', [htmlHelloMatcher])
  await verifyHTMLViaHTTP(url, '/nested/base/dir/', [htmlHelloMatcher])
}

export function verifyFrontendAPIOnRoot (t, url) {
  return verifyJSONViaHTTP(url, '/direct', 200, { ok: true })
}

export function verifyFrontendAPIOnPrefix (t, url) {
  return verifyJSONViaHTTP(url, '/frontend/direct', 200, { ok: true })
}

export function verifyFrontendAPIOnAutodetectedPrefix (t, url) {
  return verifyJSONViaHTTP(url, '/nested/base/dir/direct', 200, { ok: true })
}

export function filterConfigurations (configurations) {
  const skipped = configurations.filter(c => c.skip !== true)
  return skipped.find(c => c.only) ? skipped.filter(c => c.only) : skipped
}

export async function prepareRuntimeWithServices (
  t,
  configuration,
  production,
  language,
  prefix,
  pauseTimeout,
  additionalSetup
) {
  const { root, config } = await prepareRuntime(t, configuration, production, null, async (root, config, args) => {
    for (const type of ['backend', 'composer']) {
      await cp(resolve(commonFixturesRoot, `${type}-${language}`), resolve(root, `services/${type}`), {
        recursive: true
      })
    }

    await updateFile(resolve(root, `services/composer/routes/root.${language}`), contents => {
      return contents.replace('$PREFIX', prefix)
    })

    await additionalSetup?.(root, config, args)
  })

  return await startRuntime(t, root, config, pauseTimeout)
}

export async function verifyDevelopmentFrontendStandalone (
  t,
  configuration,
  _language,
  htmlContents,
  hmrUrl,
  hmrProtocol,
  websocketHMRHandler,
  pauseTimeout
) {
  const { url } = await createRuntime(t, configuration, pauseTimeout)

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHMR(url, '/' + hmrUrl, hmrProtocol, websocketHMRHandler)
}

export async function verifyDevelopmentFrontendWithPrefix (
  t,
  configuration,
  language,
  htmlContents,
  hmrUrl,
  hmrProtocol,
  websocketHMRHandler,
  pauseTimeout
) {
  const { runtime, url } = await prepareRuntimeWithServices(
    t,
    configuration,
    false,
    language,
    '/frontend',
    pauseTimeout
  )

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', htmlContents)
  await verifyHMR(url, '/frontend/' + hmrUrl, hmrProtocol, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/frontend/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
}

export async function verifyDevelopmentFrontendWithoutPrefix (
  t,
  configuration,
  language,
  htmlContents,
  hmrUrl,
  hmrProtocol,
  websocketHMRHandler,
  pauseTimeout
) {
  const { runtime, url } = await prepareRuntimeWithServices(t, configuration, false, language, '', pauseTimeout)

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/', htmlContents)
  await verifyHMR(url, '/' + hmrUrl, hmrProtocol, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
}

export async function verifyDevelopmentFrontendWithAutodetectPrefix (
  t,
  configuration,
  language,
  htmlContents,
  hmrUrl,
  hmrProtocol,
  websocketHMRHandler,
  pauseTimeout
) {
  const { runtime, url } = await prepareRuntimeWithServices(
    t,
    configuration,
    false,
    language,
    '/nested/base/dir',
    pauseTimeout
  )

  await verifyHTMLViaHTTP(url, '/nested/base/dir/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/nested/base/dir', htmlContents)
  await verifyHMR(url, '/nested/base/dir/' + hmrUrl, hmrProtocol, websocketHMRHandler)

  await verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })

  await verifyJSONViaInject(runtime, 'composer', 'GET', '/example', 200, { hello: 'foobar' })
  await verifyJSONViaInject(runtime, 'composer', 'GET', '/nested/base/dir/on-composer', 200, { ok: true })
  await verifyJSONViaInject(runtime, 'backend', 'GET', '/example', 200, { hello: 'foobar' })
}

export function verifyDevelopmentMode (configurations, hmrUrl, hmrProtocol, websocketHMRHandler, pauseTimeout) {
  configurations = filterConfigurations(configurations)

  for (const configuration of configurations) {
    const { id, check, htmlContents, language, hmrTriggerFile } = configuration
    test(`should start in development mode - configuration "${id}"`, async t => {
      setHMRTriggerFile(hmrTriggerFile)
      await check(t, id, language, htmlContents, hmrUrl, hmrProtocol, websocketHMRHandler, pauseTimeout)
    })
  }
}

export function verifyBuildAndProductionMode (configurations, pauseTimeout) {
  configurations = filterConfigurations(configurations)

  for (const { id, language, prefix, files, checks, additionalSetup } of configurations) {
    test(`should build and start in production mode - configuration "${id}"`, async t => {
      const { root, config } = await prepareRuntime(t, id, true, null, async (root, config, args) => {
        for (const type of ['backend', 'composer']) {
          await cp(resolve(commonFixturesRoot, `${type}-${language}`), resolve(root, `services/${type}`), {
            recursive: true
          })
        }

        await updateFile(resolve(root, `services/composer/routes/root.${language}`), contents => {
          return contents.replace('$PREFIX', prefix)
        })

        if (id.endsWith('without-prefix')) {
          await updateFile(resolve(root, 'services/composer/platformatic.json'), contents => {
            const json = JSON.parse(contents)
            json.composer.services[1].proxy = { prefix: '' }
            return JSON.stringify(json, null, 2)
          })
        }

        await additionalSetup?.(root, config, args)
      })

      const { hostname: runtimeHost, port: runtimePort, logger } = config.configManager.current.server ?? {}

      // Build
      await execa('node', [cliPath, 'build'], {
        cwd: root,
        stdio: logger?.level !== 'error' ? 'inherit' : undefined
      })

      // Make sure all file exists
      for (const file of files) {
        await ensureExists(resolve(root, file))
      }

      // Start the runtime
      const { url } = await startRuntime(t, root, config, pauseTimeout)

      if (runtimeHost) {
        const actualHost = new URL(url).hostname
        strictEqual(actualHost, runtimeHost, `hostname should be ${runtimeHost}`)
      }

      if (runtimePort) {
        const actualPort = new URL(url).port
        strictEqual(actualPort.toString(), runtimePort.toString(), `port should be ${runtimePort}`)
      }

      // Make sure all checks work properly
      for (const check of checks) {
        await check(t, url, check)
      }
    })
  }
}
