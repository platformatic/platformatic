import {
  createDirectory,
  features,
  kMetadata,
  kTimeout,
  listRecognizedConfigurationFiles,
  safeRemove
} from '@platformatic/foundation'
import { execa } from 'execa'
import * as getPort from 'get-port'
import { deepStrictEqual, fail, ok, strictEqual } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, mkdir, readdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { platform } from 'node:os'
import { basename, dirname, join, matchesGlob, resolve } from 'node:path'
import { Writable } from 'node:stream'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Agent, interceptors, request } from 'undici'
import WebSocket from 'ws'
import { create as createPlaformaticRuntime, loadConfiguration, transform } from '../../runtime/index.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'
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

// One directory again: every package that copies these applications is v4, so there is no longer a
// dialect to choose between. The function stays because it is also the one place that knows an
// application is copied to services/<type>.
export async function copyCommonApplication (root, type, language = 'js') {
  await cp(resolve(commonFixturesRoot, `${type}-${language}`), resolve(root, `services/${type}`), {
    recursive: true
  })
}

export const httpsFixtureRoot = fileURLToPath(
  new URL('../../node/test/fixtures/node-https-standalone', import.meta.url)
)

/*
  Assigning the listeners for a v4 project happens on the loaded configuration, not by rewriting a
  file. v4 configurations are code, so there is nothing to JSON.parse and edit -- and by the time
  the runtime exists the applications have already been evaluated. The resolved payload is what the
  worker receives, so setting the port there is setting the port the application binds.
*/
function applyListenerPorts (config, port) {
  const applications = config.applications ?? []
  const target = getTargetApplication(applications)
  const listeners = new Set([
    target,
    applications.find(application => application.id === 'frontend'),
    applications.find(application => application.id === 'next')
  ])

  for (const application of listeners) {
    if (!application) {
      continue
    }

    const applicationConfig = (application.resolvedConfig ??= {})
    applicationConfig.server ??= {}
    applicationConfig.server.hostname ??= '127.0.0.1'
    applicationConfig.server.port = application === target ? port : (applicationConfig.server.port ?? 0)
  }
}

function getTargetApplication (applications) {
  return applications.find(application => application.id === 'external-proxy') ??
    applications.find(application => application.id === 'composer') ??
    applications.find(application => application.id === 'gateway') ??
    applications.find(application => application.id === 'frontend') ??
    applications[0]
}

const capabilities = new Set([
  '@platformatic/astro',
  '@platformatic/composer',
  '@platformatic/db',
  '@platformatic/gateway',
  '@platformatic/nest',
  '@platformatic/next',
  '@platformatic/nitro',
  '@platformatic/node',
  '@platformatic/nuxt',
  '@platformatic/react-router',
  '@platformatic/remix',
  '@platformatic/service',
  '@platformatic/tanstack',
  '@platformatic/vite'
])

async function updateApplicationConfig (application, update, required = false) {
  if (!application?.path) {
    if (required) {
      throw new Error('Cannot find the target application configuration.')
    }
    return
  }

  /*
    A v4 application carries its evaluated configuration rather than a path to one, and its worker
    is handed that payload instead of re-reading a file. Editing a file here would therefore change
    nothing -- the runtime already holds the object the worker will receive, so the update belongs
    to it. This runs before start, which is when workerData is built.
  */
  if (application.resolvedConfig) {
    await update(application.resolvedConfig)
    return application.resolvedConfig
  }

  let configFile = application.config
  if (!configFile) {
    configFile = listRecognizedConfigurationFiles()
      .map(file => resolve(application.path, file))
      .find(file => existsSync(file))
  }

  if (!configFile) {
    const packageJsonPath = [
      resolve(application.path, 'package.json'),
      resolve(application.path, '../..', 'package.json')
    ].find(file => existsSync(file))
    const packageJson = packageJsonPath ? JSON.parse(await readFile(packageJsonPath, 'utf-8')) : {}
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
    const capability = Object.keys(dependencies).find(name => capabilities.has(name))

    if (!capability) {
      if (required) {
        throw new Error(`Cannot detect the capability for application "${application.id}".`)
      }
      return
    }

    /*
      An application the detector resolved has no configuration file, and giving it one is how the
      caller adjusts it. The file has to be v4: a legacy name in an application directory is
      refused by the loader on sight, so writing one here made the project unbootable.
    */
    configFile = join(application.path, 'watt.config.mjs')
    await writeFile(configFile, `export default ${JSON.stringify({ module: capability }, null, 2)}\n`, 'utf-8')
  }

  const applicationConfig = /\.(js|mjs|ts|mts)$/.test(configFile)
    ? (await import(`${pathToFileURL(configFile).href}?update=${Date.now()}`)).default
    : JSON.parse(await readFile(configFile, 'utf-8'))
  await update(applicationConfig)

  // Written back in the dialect it was read in.
  await writeFile(
    configFile,
    /\.(js|mjs|ts|mts)$/.test(configFile)
      ? `export default ${JSON.stringify(applicationConfig, null, 2)}\n`
      : JSON.stringify(applicationConfig, null, 2),
    'utf-8'
  )

  return applicationConfig
}

export async function updateTargetApplicationConfig (config, update) {
  return updateApplicationConfig(getTargetApplication(config.applications ?? []), update, true)
}

export async function configureHTTPS (_root, config) {
  await updateTargetApplicationConfig(config, applicationConfig => {
    applicationConfig.server ??= {}
    applicationConfig.server.hostname ??= '127.0.0.1'
    applicationConfig.server.port ??= 0
    applicationConfig.server.https = {
      key: { path: resolve(httpsFixtureRoot, 'https.key') },
      cert: { path: resolve(httpsFixtureRoot, 'https.crt') }
    }
  })
}

// It reads the loaded configuration rather than the directory, so it belongs after the load. The
// update still lands before start, which is when a worker is handed its configuration.
configureHTTPS.runAfterPrepare = true

export function createHTTPSDispatcher (t) {
  const dispatcher = new Agent({
    connect: {
      rejectUnauthorized: false
    }
  }).compose(interceptors.redirect({ maxRedirections: 1 }))

  t.after(() => dispatcher.close())
  return dispatcher
}

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

// These come from @platformatic/service and shared fixtures, where they are not listed explicitly inside applications
export const defaultDependencies = ['@platformatic/globals', 'fastify', 'typescript']

export const internalApplicationsFiles = [
  'services/composer/plugins/example.ts',
  'services/composer/routes/root.ts',
  'services/backend/plugins/example.ts',
  'services/backend/routes/root.ts'
]

export async function createTemporaryDirectory (t, prefix = 'plt-basic', root = temporaryFolder) {
  const directory = resolve(root, `${prefix}-${process.pid}-${temporaryDirectoryCount++}`)
  t.after(() => {
    if (process.env.PLT_TESTS_KEEP_TMP !== 'true') {
      safeRemove(directory)
    }
  })
  return directory
}

export async function create (t, context = {}, config = {}, name = 'base', version = '1.0.0', base = temporaryFolder) {
  await createDirectory(base)
  t.after(() => safeRemove(base))

  return new BaseCapability(
    name,
    version,
    base,
    config,
    { applicationId: 'test', ...context },
    {
      stdout: new MockedWritable(),
      stderr: new MockedWritable()
    }
  )
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
export function pause (_, runtime, url, timeout) {
  if (timeout && typeof timeout !== 'number') {
    timeout = DEFAULT_PAUSE_TIMEOUT
  }

  return new Promise(resolve => {
    // We can't use stdin since `node --test` will disable processing of stdin. Let's use a dummy HTTP server instead.
    const server = createServer((_, res) => {
      listener()
      res.writeHead(204)
      res.end()
    })

    server.listen(0)

    const separator = '-'.repeat(60)
    const message = [
      '',
      separator,
      '',
      `Runtime root: ${runtime.getRoot()}`,
      `Runtime URL : ${url.replace('[::]', '127.0.0.1')}`,
      '',
      `Make a HTTP request to http://127.0.0.1:${server.address().port} to resume.`,
      timeout < 0 ? 'The test will not resume automatically.' : `The test will resume automatically in ${timeout} ms.`,
      '',
      separator,
      ''
    ]
    process._rawDebug(message.join('\n'))

    const handler = timeout > 0 ? setTimeout(listener, timeout) : null

    function listener () {
      clearTimeout(handler)
      server.close()
      process._rawDebug('\n' + separator + '\nTest resumed.\n' + separator + '\n')
      resolve()
    }
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

/*
  beforeLoad exists for the setups that need both sides of the load: a file written into an
  application directory has to be there before v4 resolves the applications, while a change to the
  loaded configuration can only happen once there is one. A single hook cannot do both.
*/
export async function prepareRuntime (t, fixturePath, production, configFile, additionalSetup, beforeLoad) {
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
    beforeLoad = t.beforeLoad || beforeLoad
    t = t.t
  }

  source ??= resolve(fixturesDir, fixturePath)
  build ??= false
  production ??= false

  // Discover rather than assume, so a package whose fixtures have been converted to v4 and one
  // whose fixtures are still v3 both work without every test naming its configuration. The v3
  // fallback goes when the last fixture does.
  /*
    Discovery over both dialects, v4 first. A fixed fallback only worked while every fixture was
    v3, and it stopped working the moment some were not -- the fixtures that stay v3 are the ones
    whose readers still are, and a test naming none of this should not have to know which is which.
  */
  configFile ??=
    [
      'watt.config.js',
      'watt.config.mjs',
      'watt.config.ts',
      'watt.config.mts',
      'watt.json',
      'platformatic.json',
      'watt.runtime.json',
      'platformatic.runtime.json'
    ].find(candidate => existsSync(resolve(source, candidate))) ?? 'platformatic.runtime.json'

  if (port === 0) {
    port = await getPort.default()
  }

  const originalCwd = process.cwd()
  let root
  let index = 0

  await createDirectory(temporaryFolder)

  while (!root) {
    const candidate = resolve(temporaryFolder, `${basename(source)}-${index++}`)

    try {
      await mkdir(candidate)
      root = candidate
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error
      }
    }
  }

  if (process.env.PLT_TESTS_KEEP_TMP === 'true' || process.env.PLT_TESTS_PRINT_TMP === 'true') {
    process._rawDebug(`Runtime root: ${root}`)
  }

  currentWorkingDirectory = root

  // Copy the fixtures
  await cp(source, root, { recursive: true })

  /*
    Setup runs before the configuration is read, not after. v4 resolves every application when the
    root is loaded -- its directory, its capability, its own configuration -- so a setup that
    copies applications into the project has to have finished by then. Under v3 the same setup
    could run afterwards, because an application was not looked at until its worker started.

    A setup that needs the loaded configuration rather than the directory says so with
    runAfterPrepare, and still runs at the end.
  */
  if (beforeLoad) {
    await beforeLoad(root)
  }

  if (additionalSetup && !additionalSetup.runAfterPrepare) {
    await additionalSetup(root)
  }

  /*
    The root's dependencies are linked before the configuration is read, not after. v4 validates
    each application's capability configuration main-side, against the schema imported from that
    capability — so the capability has to be resolvable when the configuration is loaded, which is
    earlier in the lifecycle than v3 ever needed it. Loading first and linking afterwards worked
    only while nothing at load time went looking for the package.
  */
  await ensureDependencies([root])

  // This load exists to find the application paths so their dependencies can be linked, so it
  // deliberately skips capability validation: the capabilities are precisely what is not installed
  // yet.
  const rawConfig = await loadConfiguration(root, configFile, {
    production,
    allowMissingEntrypoint: true,
    validateCapabilities: false
  })

  await ensureDependencies(rawConfig)

  process.chdir(root)
  const runtime = await createPlaformaticRuntime(root, configFile, {
    production,
    setupSignals: false,
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.logger ??= {}

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

      // The listeners are assigned here for v4, before any worker starts: there is no configuration
      // file to rewrite afterwards, and the resolved payload is what the worker is handed.
      if (typeof port === 'number' && config[kMetadata]?.v4) {
        applyListenerPorts(config, port)
      }

      return config
    }
  })

  const config = await runtime.getRuntimeConfig(true)

  if (additionalSetup?.runAfterPrepare) {
    await additionalSetup(root, config)
  }

  if (typeof port === 'number' && !config[kMetadata]?.v4) {
    const target = getTargetApplication(config.applications ?? [])
    const listeners = new Set([
      target,
      config.applications?.find(application => application.id === 'frontend'),
      config.applications?.find(application => application.id === 'next')
    ])

    for (const application of listeners) {
      if (!application) {
        continue
      }

      await updateApplicationConfig(application, applicationConfig => {
        applicationConfig.server ??= {}
        applicationConfig.server.hostname ??= '127.0.0.1'
        applicationConfig.server.port = application === target ? port : (applicationConfig.server.port ?? 0)
      }, application === target)
    }
  }

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

  const application = getTargetApplication(runtime.getRuntimeConfig(true).applications)
  const { [`${application.id}:0`]: url } = await runtime.start()

  if (pauseAfterCreation) {
    await pause(t, runtime, url, pauseAfterCreation)
  }

  return url?.replace('[::]', '127.0.0.1')
}

export async function createRuntime (
  t,
  fixturePath,
  pauseAfterCreation = false,
  production = false,
  configFile = undefined,
  additionalSetup = null
) {
  const preparationOptions = t.constructor.name === 'TestContext'
    ? { t, root: resolve(fixturesDir, fixturePath), port: 0, production, configFile, additionalSetup }
    : { ...t, port: t.port ?? 0 }
  const { runtime, root, config } = await prepareRuntime(preparationOptions)

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
  configFile = undefined,
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

export async function verifyJSONViaHTTPS (baseUrl, path, expectedCode, expectedContent, dispatcher) {
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
    ok(
      content instanceof RegExp ? content.test(html) : html.includes(content),
      `Pattern: ${content.toString()}, Actual: ${html}`
    )
  }
}

export async function verifyHTMLViaHTTPS (baseUrl, path, contents, dispatcher) {
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
    ok(
      content instanceof RegExp ? content.test(html) : html.includes(content),
      `Pattern: ${content.toString()}, Actual: ${html}`
    )
  }
}

export async function verifyHMR (root, runtime, url, path, protocol, handler) {
  const connection = Promise.withResolvers()
  const reload = Promise.withResolvers()
  const ac = new AbortController()
  const timeout = sleep(HMR_TIMEOUT, kTimeout, { signal: ac.signal })

  // Some delay to ensure the server is ready to accept WebSocket connections
  await sleep(1000)

  const webSocket = new WebSocket(url.replace('http:', 'ws:') + path, protocol)

  webSocket.on('error', err => {
    process._rawDebug('WebSocket error:', err)
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
  const onlyFinder = c => typeof c.only !== 'undefined' && c.only !== false
  return skipped.find(onlyFinder) ? skipped.filter(onlyFinder) : skipped
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
  const { runtime, root, config } = await prepareRuntime({
    t,
    root: resolve(fixturesDir, configuration),
    production,
    port: 0,
    additionalSetup: async (root, config, _args) => {
      for (const type of ['backend', 'composer']) {
        await copyCommonApplication(root, type, language)
      }

      await updateFile(resolve(root, `services/composer/routes/root.${language}`), contents => {
        return contents.replace('$PREFIX', prefix)
      })

      if (additionalSetup && !additionalSetup.runAfterPrepare) {
        await additionalSetup?.(root, config, _args)
      }

      args = _args
    }
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
    const { id, only, todo, tag, check, htmlContents, language, hmrTriggerFile, additionalSetup } = configuration
    const timeout = typeof only === 'number' ? only : pauseTimeout

    test(`should start in development mode - configuration "${id}"${tag ? ` (${tag})` : ''}`, { todo }, async t => {
      setHMRTriggerFile(hmrTriggerFile)
      await check(t, id, language, htmlContents, hmrUrl, hmrProtocol, websocketHMRHandler, timeout, additionalSetup)
    })
  }
}

export function verifyBuildAndProductionMode (configurations, pauseTimeout) {
  configurations = filterConfigurations(configurations)

  for (const { id, only, todo, tag, language, prefix, files, checks, additionalSetup } of configurations) {
    test(
      `should build and start in production mode - configuration "${id}${tag ? ` (${tag})` : ''}"`,
      { todo },
      async t => {
        let args
        const timeout = typeof only === 'number' ? only : pauseTimeout

        const { runtime, root, config } = await prepareRuntime({
          t,
          root: resolve(fixturesDir, id),
          production: true,
          port: 0,
          additionalSetup: async (root, config, _args) => {
            for (const type of ['backend', 'composer']) {
              await copyCommonApplication(root, type, language)
            }

            await updateFile(resolve(root, `services/composer/routes/root.${language}`), contents => {
              return contents.replace('$PREFIX', prefix)
            })

            if (id.endsWith('without-prefix')) {
              // Through updateConfigFile rather than a JSON.parse of a named file: the fixture may
              // be written in either dialect, and only one of them is JSON.
              await updateConfigFile(resolve(root, 'services/composer/platformatic.json'), contents => {
                contents.gateway.applications[1].proxy = { prefix: '' }
              })
            }

            if (additionalSetup && !additionalSetup.runAfterPrepare) {
              await additionalSetup?.(root, config, _args)
            }

            args = _args
          }
        })

        if (additionalSetup && additionalSetup.runAfterPrepare) {
          await additionalSetup?.(root, config, args)
        }

        // Build
        await buildRuntime(root)

        // Make sure all file exists
        for (const file of files) {
          await ensureExists(resolve(root, file))
        }

        // Start the runtime
        const url = await startRuntime(t, runtime, timeout)

        // Make sure all checks work properly
        for (const check of checks) {
          await check(t, url, runtime)
        }
      }
    )
  }
}

export async function verifyReusePort (t, configuration, integrityCheck, additionalSetup, requestOptions = {}) {
  const port = await getPort.default()
  let protocol

  // Reads the loaded configuration, so it runs after the load and before start.
  const setup = async (root, config) => {
    await updateTargetApplicationConfig(config, applicationConfig => {
      applicationConfig.server ??= {}
      applicationConfig.server.hostname ??= '127.0.0.1'
      applicationConfig.server.port = port
      protocol = applicationConfig.server.https ? 'https' : 'http'
    })
    config.applications[0].workers = { static: features.node.reusePort ? 5 : 1, dynamic: false }
    config.preload = fileURLToPath(new URL('./helper-reuse-port.js', import.meta.url))

    await additionalSetup?.(root, config)
  }

  setup.runAfterPrepare = true

  // Create the runtime
  const { runtime, root } = await prepareRuntime(t, configuration, true, null, setup)

  // Build
  await buildRuntime(root)

  // Start the runtime
  const url = await startRuntime(t, runtime)

  deepStrictEqual(url, `${protocol}://127.0.0.1:${port}`)

  // Check that we get the response from different workers
  const workers = features.node.reusePort ? 5 : 1

  let attempts = 0
  const usedWorkers = new Set(Array.from(Array(workers)).map((_, i) => i.toString()))

  // The round robin may take a few attempts to use all workers
  while (usedWorkers.size > 0 && attempts++ < workers * 5) {
    const res = await request(url + '/', requestOptions)
    await integrityCheck?.(res)

    const worker = res.headers['x-plt-worker-id']
    ok(worker.match(/^[01234]$/))

    usedWorkers.delete(worker)
  }
}
