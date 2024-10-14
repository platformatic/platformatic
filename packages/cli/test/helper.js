import { join } from 'desm'
import { execa } from 'execa'
import { minimatch } from 'minimatch'
import { fail, ok, strictEqual } from 'node:assert'
import { readdir } from 'node:fs/promises'
import { platform } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime, startRuntime, verifyHTMLViaHTTP, verifyJSONViaHTTP } from '../../basic/test/helper.js'

export const isWindows = platform() === 'win32'
export const isCIOnWindows = process.env.CI && isWindows

export const cliPath = join(import.meta.url, '..', 'cli.js')

const htmlHelloMatcher = /Hello from (v(<!-- -->)?\d+)(\s*(t(<!-- -->)?\d+))?/

export const internalServicesFiles = [
  'services/composer/dist/plugins/example.js',
  'services/composer/dist/routes/root.js',
  'services/backend/dist/plugins/example.js',
  'services/backend/dist/routes/root.js'
]

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

export function verifyBuildAndProductionMode (fixturesDirectory, configurations, pauseTimeout) {
  configurations = filterConfigurations(configurations)

  // Do not move destructuring up here since build step will modify the object
  for (const configuration of configurations) {
    test(`configuration "${configuration.name}" - should build and create all required files`, async t => {
      configuration.runtime = await prepareRuntime(resolve(fixturesDirectory, configuration.id), true)

      const { root, config } = configuration.runtime
      configuration.serverConfig = config.configManager.current.server ?? {}

      await execa('node', [cliPath, 'build'], {
        cwd: root,
        stdio: configuration.serverConfig.logger?.level !== 'error' ? 'inherit' : undefined
      })

      for (const file of configuration.files) {
        await ensureExists(resolve(root, file))
      }
    })

    test(`configuration "${configuration.name}" - should start in production mode`, async t => {
      const { root, config } = configuration.runtime
      const { url } = await startRuntime(t, root, config, pauseTimeout)

      const runtimeHost = configuration.serverConfig?.hostname ?? null
      const runtimePort = configuration.serverConfig?.port ?? null

      if (runtimeHost) {
        const actualHost = new URL(url).hostname
        strictEqual(actualHost, runtimeHost, `hostname should be ${runtimeHost}`)
      }

      if (runtimePort) {
        const actualPort = new URL(url).port
        strictEqual(actualPort.toString(), runtimePort.toString(), `port should be ${runtimePort}`)
      }

      for (const check of configuration.checks) {
        await check(t, url, check)
      }
    })
  }
}
