import { createDirectory, safeRemove } from '@platformatic/utils'
import { join } from 'desm'
import { execa } from 'execa'
import fastify from 'fastify'
import { minimatch } from 'minimatch'
import { fail, ok } from 'node:assert'
import { cp, readdir, readFile, writeFile } from 'node:fs/promises'
import { platform, tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runServer } from 'verdaccio'
import { pause, verifyHTMLViaHTTP, verifyJSONViaHTTP } from '../../basic/test/helper.js'
import { loadConfig } from '../../config/index.js'
import { buildServer, platformaticRuntime } from '../../runtime/index.js'

let count = 0

/*
  If the env var is undefined, a temporary folder will be created and disposed after the tests
  in verifyBuild and verifyProduction. Setting a value to keep the folder should be used for debugging only.
*/
const temporaryWorkingDirectory = process.env.PLT_TEMPORARY_DIRECTORY

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

export async function verifyPlatformaticService (t, url) {
  await verifyJSONViaHTTP(url, '/backend/example', 200, { hello: 'foobar' })
  await verifyJSONViaHTTP(url, '/backend/time', 200, body => {
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

export async function startVerdaccio (root) {
  const verdaccioRoot = resolve(root, 'tmp/verdaccio')

  await createDirectory(verdaccioRoot)

  const verdaccio = await runServer({
    self_path: verdaccioRoot,
    logs: {
      type: 'file',
      path: resolve(verdaccioRoot, 'verdaccio.log'),
      level: 'error'
    },
    storage: verdaccioRoot,
    web: { enable: false },
    uplinks: {
      npmjs: {
        url: 'https://registry.npmjs.org/',
        cache: true
      }
    },
    packages: {
      '**': {
        access: '$all',
        publish: '$authenticated',
        proxy: 'npmjs'
      }
    }
  })

  return new Promise((resolve, reject) => {
    return verdaccio.listen({ port: 0 }, resolve.bind(null, verdaccio)).on('error', reject)
  })
}

export async function stopVerdaccio (verdaccio) {
  await new Promise((resolve, reject) => {
    verdaccio?.close(error => {
      /* c8 ignore next 3 */
      if (error) {
        return reject(error)
      }

      resolve()
    })
  })
}

export async function startDeployService (t, options = {}) {
  const deployService = fastify({ keepAliveTimeout: 1 })

  deployService.post('/bundles', async (request, reply) => {
    const createBundleCallback = options.createBundleCallback || (() => {})
    await createBundleCallback(request, reply)

    return {
      id: 'default-bundle-id',
      token: 'default-upload-token',
      isBundleUploaded: false
    }
  })

  deployService.post('/deployments', async (request, reply) => {
    const createDeploymentCallback = options.createDeploymentCallback || (() => {})
    await createDeploymentCallback(request, reply)
  })

  deployService.addContentTypeParser('application/x-tar', { bodyLimit: 1024 * 1024 * 1024 }, (request, payload, done) =>
    done()
  )

  deployService.put('/upload', async (request, reply) => {
    const uploadCallback = options.uploadCallback || (() => {})
    await uploadCallback(request, reply)
  })

  t.after(async () => {
    await deployService.close()
  })

  return deployService.listen({ port: 3042 })
}

export async function startMachine (t, callback = () => {}) {
  const machine = fastify({ keepAliveTimeout: 1 })

  machine.get('/', async (request, reply) => {
    await callback(request, reply)
  })

  t.after(async () => {
    await machine.close()
  })

  return machine.listen({ port: 0 })
}

export async function createProductionRuntime (t, configFile, pauseAfterCreation = false) {
  const config = await loadConfig({}, ['-c', configFile, '--production'], platformaticRuntime)
  const runtime = await buildServer(config.configManager.current, config.args)

  const url = await runtime.start()
  t.after(async () => runtime.close())

  if (pauseAfterCreation) {
    await pause(t, url, pauseAfterCreation)
  }

  return { runtime, url }
}

export async function packPackages (root, destination) {
  const packagesDirectory = resolve(destination, 'packages')
  const overrides = {}
  const packages = await readdir(resolve(root, 'packages'))

  await Promise.all(
    packages.map(async pkg => {
      if (pkg.startsWith('.')) {
        return
      }

      let name = `@platformatic/${pkg}`

      if (pkg === 'cli') {
        name = 'platformatic'
      } else if (pkg === 'create-platformatic') {
        name = pkg
      }

      const { stdout: path } = await execa('pnpm', ['pack', '--pack-destination', packagesDirectory], {
        cwd: resolve(root, 'packages', pkg)
      })

      overrides[name] = pathToFileURL(path.trim()).toString()
    })
  )

  return overrides
}

export async function prepareWorkingDirectory (t, source, destination, configurations) {
  // This is to fix temporary to a specific directory
  if (!destination) {
    destination = resolve(tmpdir(), `test-cli-packages-${process.pid}-${count++}`)
    t.after(() => safeRemove(destination))
  }

  // Recreate the folder
  console.time('Create folder')
  await safeRemove(destination)
  await createDirectory(dirname(destination))
  console.timeEnd('Create folder')

  // Pack packages
  console.time('Pack packages')
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const overrides = await packPackages(root, destination)
  console.timeEnd('Pack packages')

  // Copy files
  console.time('Copy files')
  await cp(source, destination, { recursive: true })
  console.timeEnd('Copy files')

  // Start Verdaccio
  const useVerdaccio = process.env.VERDACCIO === 'true'
  let verdaccio

  if (useVerdaccio) {
    verdaccio = await startVerdaccio(root)
  }

  try {
    // Override package.json and .npmrc
    const packageJson = JSON.parse(await readFile(resolve(destination, 'package.json'), 'utf-8'))
    packageJson.pnpm = { overrides }
    await writeFile(resolve(destination, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8')

    if (useVerdaccio) {
      await writeFile(
        resolve(destination, '.npmrc'),
        `
registry=http://localhost:${verdaccio.address().port}
node-linker=hoisted
package-import-method=copy
hoist=false
shamefully-hoist=true
`,
        'utf-8'
      )
    } else {
      await writeFile(
        resolve(destination, '.npmrc'),
        `
node-linker=hoisted
package-import-method=copy
hoist=false
shamefully-hoist=true
`,
        'utf-8'
      )
    }

    // Create the pnpm-workspace.yml file
    let workspaceFile = 'packages:\n'
    for (const configuration of configurations) {
      workspaceFile += `  - '${configuration.id}'\n`
      workspaceFile += `  - '${configuration.id}/services/*'\n`
    }

    await writeFile(resolve(destination, 'pnpm-workspace.yaml'), workspaceFile, 'utf-8')

    console.time('pnpm install')
    await execa('pnpm', ['install', '--no-frozen-lockfile'], { cwd: destination })
    console.timeEnd('pnpm install')
  } finally {
    if (useVerdaccio) {
      await stopVerdaccio(verdaccio)
    }
  }

  return destination
}

export function filterConfigurations (configurations) {
  const skipped = configurations.filter(c => c.skip !== true)
  return skipped.find(c => c.only) ? skipped.filter(c => c.only) : skipped
}

export function install (workingDirectory, temporaryRoot, configurations, skipInstall) {
  if (temporaryRoot) {
    test.before(t => {
      console.log(`Persistent working directory is "${temporaryRoot}".`)
    })
  }

  if (!skipInstall) {
    test.before(async t => {
      const configurationWorkingDirectory = await prepareWorkingDirectory(
        t,
        workingDirectory,
        temporaryRoot,
        configurations
      )

      if (!temporaryRoot) {
        console.log(`Temporary working directory is "${configurationWorkingDirectory}".`)
      }

      for (const configuration of configurations) {
        configuration.baseWorkingDirectory = configurationWorkingDirectory
      }
    })
  } else {
    // If set here, it means temporaryRoot was not empty
    for (const configuration of configurations) {
      configuration.baseWorkingDirectory = temporaryRoot
      configuration.workingDirectory = resolve(temporaryRoot, configuration.id)
    }
  }
}

export function verifyBuildAndProductionMode (workingDirectory, configurations, skipInstall, skipBuild, pauseTimeout) {
  configurations = filterConfigurations(configurations)
  install(workingDirectory, temporaryWorkingDirectory, configurations, skipInstall)

  // Do not move destructuring up here since workingDirectory might the test.before and therefore empty
  for (const configuration of configurations) {
    if (!skipBuild) {
      test(`configuration "${configuration.name}" - should build and create all required files`, async t => {
        const { id, baseWorkingDirectory } = configuration
        t.diagnostic(`starting build for ${id}`)
        configuration.workingDirectory = resolve(baseWorkingDirectory, id)

        const runtimeConfig = JSON.parse(
          await readFile(resolve(configuration.workingDirectory, 'platformatic.runtime.json'))
        )

        // Build using "platformatic build"
        await execa('node', [cliPath, 'build'], {
          cwd: configuration.workingDirectory,
          stdio: runtimeConfig.server?.logger?.level !== 'error' ? 'inherit' : undefined
        })

        for (const file of configuration.files) {
          await ensureExists(resolve(configuration.workingDirectory, file))
        }
      })
    }

    test(`configuration "${configuration.name}" - should start in production mode`, async t => {
      t.diagnostic(`starting production for ${configuration.id}`)
      // Start in production mode
      const { url } = await createProductionRuntime(
        t,
        resolve(configuration.workingDirectory, 'platformatic.runtime.json'),
        pauseTimeout
      )

      for (const check of configuration.checks) {
        await check(t, url, check)
      }
    })
  }
}
