import { createDirectory, safeRemove, withResolvers } from '@platformatic/utils'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { existsSync } from 'node:fs'
import { cp, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
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

export let fixturesDir
let currentWorkingDirectory
let hmrTriggerFileRelative

export const temporaryFolder = await realpath(tmpdir())
export const pltRoot = fileURLToPath(new URL('../../..', import.meta.url))

// These come from @platformatic/service, where they are not listed explicitly inside services
export const defaultDependencies = ['fastify', 'typescript']
let additionalDependencies

export function createStackable (
  context = {},
  config = { current: {} },
  name = 'base',
  version = '1.0.0',
  base = temporaryFolder
) {
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
export function pause (t, url, timeout) {
  if (timeout && typeof timeout !== 'number') {
    timeout = DEFAULT_PAUSE_TIMEOUT
  }

  console.log(`--- Pausing on test "${t.name}" - Server is listening at ${url}. Press any key to resume ...`)

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
      }
    }
  }
}

export async function prepareRuntime (fixturePath, production = false, configFile = 'platformatic.runtime.json') {
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

  // Ensure the dependencies
  await ensureDependencies(config)

  return { root, config, args }
}

export async function startRuntime (t, root, config, pauseAfterCreation = false) {
  const runtime = await buildServer(config.configManager.current, config.args)
  const url = await runtime.start()

  t.after(async () => {
    await runtime.close()
    await safeRemove(root)
  })

  if (pauseAfterCreation) {
    await pause(t, url, pauseAfterCreation)
  }

  return { runtime, url }
}

export async function createRuntime (
  t,
  fixturePath,
  pauseAfterCreation = false,
  production = false,
  configFile = 'platformatic.runtime.json'
) {
  const { root, config } = await prepareRuntime(fixturePath, production, configFile)

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
