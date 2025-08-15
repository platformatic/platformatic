'use strict'

// Disable profiling to avoid conflicts in tests
process.env.PLT_DISABLE_FLAMEGRAPHS = '1'

const { loadConfig } = require('../../config/index.js')
const { basename, resolve, dirname, join } = require('node:path')
const { buildServer, platformaticRuntime } = require('../../runtime/index.js')
const { existsSync } = require('node:fs')
const { cp, readFile, symlink } = require('node:fs/promises')
const { platform } = require('node:os')
const { createDirectory, safeRemove } = require('../../utils/index.js')

let fixturesDir
let additionalDependencies

const pltRoot = resolve(join(__dirname, '..', '..', '..'))
const temporaryFolder = join(__dirname, '..', 'tmp')

// These come from @platformatic/service, where they are not listed explicitly inside services
const defaultDependencies = ['fastify', 'typescript']

const isWindows = platform() === 'win32'

async function ensureDependencies (configOrPaths) {
  const paths = Array.isArray(configOrPaths)
    ? configOrPaths
    : [configOrPaths.configManager.dirname, ...configOrPaths.configManager.current.services.map(s => s.path)]

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

const prepareRuntime = async (t, fixturePath, production, configFile, additionalSetup) => {
  production ??= false
  configFile ??= 'platformatic.runtime.json'

  const root = resolve(temporaryFolder, basename(fixturePath) + '-' + Date.now())

  await createDirectory(root)

  // Copy the fixtures
  await cp(resolve(fixturesDir, fixturePath), root, { recursive: true })

  // Init the runtime
  const args = ['-c', resolve(root, configFile)]

  if (production) {
    args.push('--production')
  }

  // Ensure the dependencies
  await ensureDependencies([root])

  const config = await loadConfig({}, args, platformaticRuntime)

  await additionalSetup?.(root, config, args)
  // Ensure the dependencies
  await ensureDependencies(config)

  return { root, config, args }
}

const startRuntime = async (t, root, config) => {
  const originalCwd = process.cwd()
  process.chdir(root)
  const runtime = await buildServer(config.configManager.current, config.args)

  const url = await runtime.start()
  t.after(async () => {
    process.chdir(originalCwd)
    await runtime.close()
    await safeRemove(root)
  })

  return { runtime, url, root }
}

const createRuntime = async (
  t,
  fixturePath,
  production = false,
  configFile = 'platformatic.json'
) => {
  const { root, config } = await prepareRuntime(t, fixturePath, production, configFile)

  return startRuntime(t, root, config)
}

const setFixturesDir = (directory) => {
  fixturesDir = directory
}

module.exports = {
  createRuntime,
  prepareRuntime,
  startRuntime,
  setFixturesDir,
}
