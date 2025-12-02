import { createDirectory, features, kMetadata, kTimeout, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import * as getPort from 'get-port'
import { deepStrictEqual, fail, ok, strictEqual } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, readdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { platform } from 'node:os'
import { basename, dirname, join, matchesGlob, resolve } from 'node:path'
import { Writable } from 'node:stream'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { Agent, interceptors, request } from 'undici'
import WebSocket from 'ws'
import { create as createPlaformaticRuntime, loadConfiguration, transform } from '../../runtime/index.js'
import { BaseCapability } from '../lib/capability.js'

export { setTimeout as sleep, setImmediate as sleepImmediate } from 'node:timers/promises'

const htmlHelloMatcher = /Hello from (v(<!-- -->)?\d+)(\s*(t(<!-- -->)?\d+))?/

let currentWorkingDirectory
let hmrTriggerFileRelative
let additionalDependencies
let temporaryDirectoryCount = 0

export const LOGS_TIMEOUT = 100
export const HMR_TIMEOUT = process.env.CI ? 20000 : 10000
export const DEFAULT_PAUSE_TIMEOUT = 300000

export let fixturesDir
export const isWindows = platform() === 'win32'
export const isCIOnWindows = process.env.CI && isWindows
export const cliPath = join(import.meta.dirname, '../../wattpm', 'bin/cli.js')
export const pltRoot = fileURLToPath(new URL('../../..', import.meta.url))
export const temporaryFolder = fileURLToPath(new URL('../../../tmp', import.meta.url))
export const commonFixturesRoot = fileURLToPath(new URL('./fixtures/common', import.meta.url))

class MockedWritable extends Writable {
  constructor () {
    super()

    this.verbose = process.env.PLT_TESTS_DEBUG === 'true'
    this.messages = []
  }

  _write (chunk, _, cb) {
    const message = chunk.toString('utf-8').trim()
    this.messages.push(message)

    if (this.verbose) {
      process._rawDebug(message)
    }

    cb()
  }
}

// These come from @platformatic/service, where they are not listed explicitly inside applications
export const defaultDependencies = ['fastify', 'typescript']

export const internalApplicationsFiles = [
  'services/composer/plugins/example.ts',
  'services/composer/routes/root.ts',
  'services/backend/plugins/example.ts',
  'services/backend/routes/root.ts'
]

export async function createTemporaryDirectory (t, prefix = 'plt-basic') {
  const directory = resolve(temporaryFolder, `${prefix}-${process.pid}-${temporaryDirectoryCount++}`)
  t.after(() => safeRemove(directory))
  return directory
}

export async function create (t, context = {}, config = {}, name = 'base', version = '1.0.0', base = temporaryFolder) {
  await createDirectory(base)
  t.after(() => safeRemove(base))

  return new BaseCapability(name, version, base, config, context, {
    stdout: new MockedWritable(),
    stderr: new MockedWritable()
  })
}

export function getExecutedCommandLogMessage (command) {
  // This is needed to handle backslashes on Windows
  return JSON.stringify(`Executing "${command}" ...`)
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
export function pause (t, url, timeout) {
  if (timeout && typeof timeout !== 'number') {
    timeout = DEFAULT_PAUSE_TIMEOUT
  }

  console.log(
    `--- Pausing on test "${t.name}" - Server is listening at ${url.replace('[::]', '127.0.0.1')}/. Press any key to resume ...`
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

  return {
    revert () {
      return writeFile(path, contents, 'utf-8')
    }
  }
}

export async function ensureDependencies (configOrPaths) {
  const paths = Array.isArray(configOrPaths)
    ? configOrPaths
    : [configOrPaths[kMetadata].root, ...configOrPaths.applications.map(s => s.path)]
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
      try {
        await symlink(resolved, moduleRoot, 'dir')
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err
        }
      }

      // Now link all the binaries
      const { bin } = JSON.parse(await readFile(resolve(moduleRoot, 'package.json'), 'utf-8'))

      for (const [name, destination] of Object.entries(bin ?? {})) {
        const actual = resolve(moduleRoot, destination)
        try {
          await symlink(actual, resolve(binFolder, name), 'file')
        } catch (err) {
          if (err.code !== 'EEXIST') {
            throw err
          }
        }

        // Fix for NPM on Windows
        if (isWindows) {
          try {
            await symlink(
              resolve(pltRoot, 'node_modules/.bin', `${name}.ps1`),
              resolve(binFolder, `${name}.ps1`),
              'file'
            )
            await symlink(
              resolve(pltRoot, 'node_modules/.bin', `${name}.cmd`),
              resolve(binFolder, `${name}.cmd`),
              'file'
            )
          } catch (err) {
            if (err.code !== 'EEXIST') {
              throw err
            }
          }
        }
      }
    }
  }
}

export async function buildRuntime (root) {
  const originalCwd = process.cwd()

  process.chdir(root)
  await execa('node', [cliPath, 'build'], { cwd: root })
  process.chdir(originalCwd)
}

export async function prepareRuntime (t, fixturePath, production, configFile, additionalSetup) {
  let source
  let port
  let build

  if (t.constructor.name !== 'TestContext') {
    source = t.root
    port = t.port
    build = t.build
    production = t.production ?? production
    configFile = t.configFile ?? configFile
    additionalSetup = t.additionalSetup || additionalSetup
    t = t.t
  }

  source ??= resolve(fixturesDir, fixturePath)
  build ??= false
  production ??= false
  configFile ??= 'platformatic.runtime.json'

  if (port === 0) {
    port = await getPort.default()
  }

  const originalCwd = process.cwd()
  const root = resolve(temporaryFolder, basename(source) + '-' + Date.now())

  if (process.env.PLT_TESTS_PRINT_TMP === 'true') {
    process._rawDebug(`Runtime root: ${root}`)
  }

  currentWorkingDirectory = root

  await createDirectory(root)

  // Copy the fixtures
  await cp(source, root, { recursive: true })

  const rawConfig = await loadConfiguration(root, configFile, { production, allowMissingEntrypoint: true })

  await ensureDependencies([root])
  await ensureDependencies(rawConfig)

  process.chdir(root)
  const runtime = await createPlaformaticRuntime(root, configFile, {
    production,
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.logger ??= {}
      config.server ??= {}

      // Assign the port
      if (typeof port === 'number') {
        config.server.port = port
      }

      const debug = process.env.PLT_TESTS_DEBUG === 'true'
      const verbose = process.env.PLT_TESTS_VERBOSE === 'true'

      if (verbose) {
        config.logger.level = debug ? 'trace' : 'info'
      } else {
        if (debug) {
          config.logger.level = 'trace'
          process._rawDebug('Runtime logs:', resolve(root, 'logs.txt'))
        }

        config.logger.transport ??= {
          target: 'pino/file',
          options: { destination: resolve(root, 'logs.txt') }
        }
      }

      return config
    }
  })

  const config = await runtime.getRuntimeConfig(true)
  await additionalSetup?.(root, config)

  // Ensure dependencies again for updated config
  await ensureDependencies(config)
  process.chdir(originalCwd)

  t.after(async () => {
    process.chdir(originalCwd)
    await runtime.close()

    if (process.env.PLT_TESTS_KEEP_TMP !== 'true') {
      await safeRemove(root)
    } else {
      process._rawDebug(`Keeping temporary folder: ${root}`)
    }
  })

  // Build the runtime if needed
  if (build) {
    await buildRuntime(root)
  }

  return { runtime, root, config }
}

export async function startRuntime (t, runtime, pauseAfterCreation = false, applicationsToBuild = false) {
  if (Array.isArray(applicationsToBuild)) {
    await runtime.init()

    for (const application of applicationsToBuild) {
      await runtime.buildApplication(application)
    }
  }

  const url = await runtime.start()

  if (pauseAfterCreation) {
    await pause(t, url, pauseAfterCreation)
  }

  return url?.replace('[::]', '127.0.0.1')
}

export async function createRuntime (
  t,
  fixturePath,
  pauseAfterCreation = false,
  production = false,
  configFile = 'platformatic.runtime.json',
  additionalSetup = null
) {
  const { runtime, root, config } = await prepareRuntime(t, fixturePath, production, configFile, additionalSetup)

  if (t.constructor.name !== 'TestContext') {
    pauseAfterCreation = t.pauseAfterCreation ?? pauseAfterCreation
    t = t.t
  }

  const url = await startRuntime(t, runtime, pauseAfterCreation)

  return { runtime, root, config, url }
}

export async function createProductionRuntime (
  t,
  fixturePath,
  pauseAfterCreation = false,
  configFile = 'platformatic.runtime.json',
  additionalSetup = null
) {
  return createRuntime(t, fixturePath, pauseAfterCreation, true, configFile, additionalSetup)
}

export async function getLogsFromFile (root) {
  return (await readFile(resolve(root, 'logs.txt'), 'utf-8')).split('\n').filter(Boolean).map(JSON.parse)
}

export async function verifyJSONViaHTTP (baseUrl, path, expectedCode, expectedContent) {
  const dispatcher = new Agent().compose(interceptors.redirect({ maxRedirections: 1 }))
  const { statusCode, body } = await request(baseUrl + path, { dispatcher })
  strictEqual(statusCode, expectedCode)

  if (typeof expectedContent === 'function') {
    return expectedContent(await body.json())
  }

  deepStrictEqual(await body.json(), expectedContent)
}

export async function verifyJSONViaInject (app, applicationId, method, url, expectedCode, expectedContent) {
  const { statusCode, body } = await app.inject(applicationId, { method, url })
  strictEqual(statusCode, expectedCode)

  if (typeof expectedContent === 'function') {
    return expectedContent(JSON.parse(body))
  }

  deepStrictEqual(JSON.parse(body), expectedContent)
}

export async function verifyHTMLViaHTTP (baseUrl, path, contents) {
  const dispatcher = new Agent().compose(interceptors.redirect({ maxRedirections: 1 }))
  const { statusCode, headers, body } = await request(baseUrl + path, { dispatcher })
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

export async function verifyHTMLViaInject (app, applicationId, url, contents) {
  const { statusCode, headers, body: html } = await app.inject(applicationId, { method: 'GET', url })

  if (statusCode === 308) {
    return app.inject(applicationId, { method: 'GET', url: headers.location })
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

export async function verifyHMR (root, runtime, url, path, protocol, handler) {
  const connection = Promise.withResolvers()
  const reload = Promise.withResolvers()
  const ac = new AbortController()
  const timeout = sleep(HMR_TIMEOUT, kTimeout, { signal: ac.signal })

  const webSocket = new WebSocket(url.replace('http:', 'ws:') + path, protocol)

  webSocket.on('error', err => {
    clearTimeout(timeout)
    connection.reject(err)
    reload.reject(err)
  })

  webSocket.on('message', data => {
    handler(JSON.parse(data), connection.resolve, reload.resolve, { root, runtime, url, path, protocol })
  })

  const hmrTriggerFile = resolve(currentWorkingDirectory, hmrTriggerFileRelative)
  const originalContents = await readFile(hmrTriggerFile, 'utf-8')
  try {
    if ((await Promise.race([connection.promise, timeout])) === kTimeout) {
      throw new Error('Timeout while waiting for HMR connection')
    }

    await sleep(1000)
    await writeFile(hmrTriggerFile, originalContents.replace('const version = 123', 'const version = 456'), 'utf-8')

    if ((await Promise.race([reload.promise, timeout])) === kTimeout) {
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
    existing.some(e => matchesGlob(e, pattern)),
    `Pattern ${path} not found.`
  )
}

export function verifyPlatformaticGateway (_, url) {
  return verifyJSONViaHTTP(url, '/example', 200, { hello: 'foobar' })
}

export function verifyPlatformaticGatewayWithProxy (_, url) {
  return verifyJSONViaHTTP(url, '/external-proxy/example', 200, { hello: 'foobar' })
}

export async function verifyPlatformaticService (_, url) {
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/time', 200, body => {
    ok(typeof body.time === 'number')
  })
}

export async function verifyPlatformaticServiceWithProxy (_, url) {
  await verifyJSONViaHTTP(url, '/external-proxy/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/external-proxy/backend/time', 200, body => {
    ok(typeof body.time === 'number')
  })
}

export async function verifyPlatformaticDB (_, url) {
  await verifyJSONViaHTTP(url, '/db/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/db/movies/', 200, [])
}

export async function verifyFrontendOnRoot (_, url) {
  await verifyHTMLViaHTTP(url, '/', [htmlHelloMatcher])
}

export async function verifyFrontendOnPrefix (_, url) {
  await verifyHTMLViaHTTP(url, '/frontend', [htmlHelloMatcher])
  await verifyHTMLViaHTTP(url, '/frontend/', [htmlHelloMatcher])
}

export async function verifyFrontendOnPrefixWithProxy (_, url) {
  await verifyHTMLViaHTTP(url, '/external-proxy/frontend', [htmlHelloMatcher])
  await verifyHTMLViaHTTP(url, '/external-proxy/frontend/', [htmlHelloMatcher])
}

export async function verifyFrontendOnAutodetectedPrefix (_, url) {
  await verifyHTMLViaHTTP(url, '/nested/base/dir', [htmlHelloMatcher])
  await verifyHTMLViaHTTP(url, '/nested/base/dir/', [htmlHelloMatcher])
}

export function verifyFrontendAPIOnRoot (_, url) {
  return verifyJSONViaHTTP(url, '/direct', 200, { ok: true })
}

export function verifyFrontendAPIOnPrefix (_, url) {
  return verifyJSONViaHTTP(url, '/frontend/direct', 200, { ok: true })
}

export function verifyFrontendAPIOnAutodetectedPrefix (_, url) {
  return verifyJSONViaHTTP(url, '/nested/base/dir/direct', 200, { ok: true })
}

export function filterConfigurations (configurations) {
  const skipped = configurations.filter(c => c.skip !== true)
  return skipped.find(c => c.only) ? skipped.filter(c => c.only) : skipped
}

export async function prepareRuntimeWithApplications (
  t,
  configuration,
  production,
  language,
  prefix,
  pauseTimeout,
  additionalSetup
) {
  let args
  const { runtime, root, config } = await prepareRuntime(t, configuration, production, null, async (
    root,
    config,
    _args
  ) => {
    for (const type of ['backend', 'composer']) {
      await cp(resolve(commonFixturesRoot, `${type}-${language}`), resolve(root, `services/${type}`), {
        recursive: true
      })
    }

    await updateFile(resolve(root, `services/composer/routes/root.${language}`), contents => {
      return contents.replace('$PREFIX', prefix)
    })

    if (additionalSetup && !additionalSetup.runAfterPrepare) {
      await additionalSetup?.(root, config, _args)
    }

    args = _args
  })

  if (additionalSetup && additionalSetup.runAfterPrepare) {
    await additionalSetup?.(root, config, args)
  }

  const url = await startRuntime(t, runtime, pauseTimeout)
  return { runtime, root, config, url }
}

export async function verifyDevelopmentFrontendStandalone (
  t,
  configuration,
  _language,
  htmlContents,
  hmrUrl,
  hmrProtocol,
  websocketHMRHandler,
  pauseTimeout,
  additionalSetup
) {
  const { root, runtime, url } = await createRuntime(t, configuration, pauseTimeout, false, null, additionalSetup)

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHMR(root, runtime, url, '/' + hmrUrl, hmrProtocol, websocketHMRHandler)
}

export async function verifyDevelopmentFrontendWithPrefix (
  t,
  configuration,
  language,
  htmlContents,
  hmrUrl,
  hmrProtocol,
  websocketHMRHandler,
  pauseTimeout,
  additionalSetup
) {
  const { root, runtime, url } = await prepareRuntimeWithApplications(
    t,
    configuration,
    false,
    language,
    '/frontend',
    pauseTimeout,
    additionalSetup
  )

  await verifyHTMLViaHTTP(url, '/frontend/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/frontend', htmlContents)
  await verifyHMR(root, runtime, url, '/frontend/' + hmrUrl, hmrProtocol, websocketHMRHandler)

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
  pauseTimeout,
  additionalSetup
) {
  const { root, runtime, url } = await prepareRuntimeWithApplications(
    t,
    configuration,
    false,
    language,
    '',
    pauseTimeout,
    additionalSetup
  )

  await verifyHTMLViaHTTP(url, '/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/', htmlContents)
  await verifyHMR(root, runtime, url, '/' + hmrUrl, hmrProtocol, websocketHMRHandler)

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
  pauseTimeout,
  additionalSetup
) {
  const { root, runtime, url } = await prepareRuntimeWithApplications(
    t,
    configuration,
    false,
    language,
    '/nested/base/dir',
    pauseTimeout,
    additionalSetup
  )

  await verifyHTMLViaHTTP(url, '/nested/base/dir/', htmlContents)
  await verifyHTMLViaInject(runtime, 'composer', '/nested/base/dir', htmlContents)
  await verifyHMR(root, runtime, url, '/nested/base/dir/' + hmrUrl, hmrProtocol, websocketHMRHandler)

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
    const { id, todo, tag, check, htmlContents, language, hmrTriggerFile, additionalSetup } = configuration
    test(`should start in development mode - configuration "${id}"${tag ? ` (${tag})` : ''}`, { todo }, async t => {
      setHMRTriggerFile(hmrTriggerFile)
      await check(
        t,
        id,
        language,
        htmlContents,
        hmrUrl,
        hmrProtocol,
        websocketHMRHandler,
        pauseTimeout,
        additionalSetup
      )
    })
  }
}

export function verifyBuildAndProductionMode (configurations, pauseTimeout) {
  configurations = filterConfigurations(configurations)

  for (const { id, todo, tag, language, prefix, files, checks, additionalSetup } of configurations) {
    test(
      `should build and start in production mode - configuration "${id}${tag ? ` (${tag})` : ''}"`,
      { todo },
      async t => {
        let args
        const { runtime, root, config } = await prepareRuntime(t, id, true, null, async (root, config, _args) => {
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
              json.gateway.applications[1].proxy = { prefix: '' }
              return JSON.stringify(json, null, 2)
            })
          }

          if (additionalSetup && !additionalSetup.runAfterPrepare) {
            await additionalSetup?.(root, config, _args)
          }

          args = _args
        })

        if (additionalSetup && additionalSetup.runAfterPrepare) {
          await additionalSetup?.(root, config, args)
        }

        const { hostname: runtimeHost, port: runtimePort } = config.server ?? {}

        // Build
        await buildRuntime(root)

        // Make sure all file exists
        for (const file of files) {
          await ensureExists(resolve(root, file))
        }

        // Start the runtime
        const url = await startRuntime(t, runtime, pauseTimeout)

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
          await check(t, url, runtime)
        }
      }
    )
  }
}

export async function verifyReusePort (t, configuration, integrityCheck, additionalSetup) {
  const port = await getPort.default()

  // Create the runtime
  const { runtime, root } = await prepareRuntime(t, configuration, true, null, async (root, config) => {
    config.server = { port }
    config.applications[0].workers = { static: 5, dynamic: false }
    config.preload = fileURLToPath(new URL('./helper-reuse-port.js', import.meta.url))

    await additionalSetup?.(root, config)
  })

  // Build
  await buildRuntime(root)

  // Start the runtime
  const url = await startRuntime(t, runtime)

  deepStrictEqual(url, `http://127.0.0.1:${port}`)

  // Check that we get the response from different workers
  const workers = features.node.reusePort ? 5 : 1

  const usedWorkers = new Set()

  const promises = Array.from(Array(workers)).map(async () => {
    const res = await request(url + '/')
    await integrityCheck?.(res)

    const worker = res.headers['x-plt-worker-id']
    ok(worker.match(/^[01234]$/))

    usedWorkers.add(worker)
  })

  await Promise.all(promises)

  if (workers > 1) {
    ok(usedWorkers.size > 1)
  }
}
