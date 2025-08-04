import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import fastify from 'fastify'
import { promises as fs } from 'node:fs'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { platform, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const isWindows = platform() === 'win32'
const pltCreatePath = fileURLToPath(new URL('../../bin/create-platformatic.mjs', import.meta.url))
const pltRoot = fileURLToPath(new URL('../..', import.meta.url))
let tmpCount = 0

export async function getServices (dir) {
  const files = await fs.readdir(dir)
  const services = []
  for (const file of files) {
    services.push(file)
  }
  return services
}

export async function createTemporaryDirectory (t, prefix) {
  const directory = join(tmpdir(), `test-create-platformatic-${prefix}-${process.pid}-${tmpCount++}`)

  t.after(async () => {
    await safeRemove(directory)
  })

  await mkdir(directory)
  return directory
}

export async function setupUserInputHandler (t, expected) {
  const temporaryFolder = await createTemporaryDirectory(t, 'inquirer')
  let inputHandler = resolve(temporaryFolder, 'input-handler.mjs')

  const template = await readFile(new URL('../fixtures/input-handler.mjs', import.meta.url), 'utf-8')

  await writeFile(
    inputHandler,
    template.replace('const expected = []', `const expected = ${JSON.stringify(expected)}\n`),
    'utf-8'
  )

  if (isWindows) {
    inputHandler = pathToFileURL(inputHandler).toString()
  }

  return inputHandler
}

// Actions are in the form:
export async function executeCreatePlatformatic (dir, options = {}) {
  const pkgMgrInstall = options.pkgMgrInstall || false
  const pkgManager = options.pkgManager || 'npm'
  const marketplaceHost = options.marketplaceHost

  const execaOptions = {
    cwd: dir,
    env: {
      NO_COLOR: 'true',
      PLT_MARKETPLACE_TEST: 'true',
      PLT_MODULES_PATHS: JSON.stringify({ '@platformatic/vite': resolve(pltRoot, '../vite') }),
      PLT_USER_INPUT_HANDLER: options.userInputHandler
    }
  }

  if (pkgManager === 'pnpm') {
    execaOptions.env.npm_config_user_agent = 'pnpm/6.14.1 npm/? node/v16.4.2 darwin x64'
  }

  const child = execa(
    'node',
    [
      pltCreatePath,
      `--install=${pkgMgrInstall.toString()}`,
      `--marketplace-host=${marketplaceHost}`,
      ...(options.args ?? [])
    ],
    execaOptions
  )

  return child
}

export async function startMarketplace (t, opts = {}) {
  const marketplace = fastify()

  marketplace.get('/templates', async (request, reply) => {
    if (opts.templatesCallback) {
      return opts.templatesCallback(request, reply)
    }
    return [{ name: '@platformatic/composer' }, { name: '@platformatic/db' }, { name: '@platformatic/service' }]
  })

  await marketplace.listen({ port: 0 })
  t.after(() => marketplace.close())

  const address = marketplace.server.address()
  return `http://127.0.0.1:${address.port}`
}

export async function linkDependencies (projectDir, dependencies) {
  for (const dep of dependencies) {
    const moduleRoot = resolve(projectDir, 'node_modules', dep)
    const resolved = resolve(pltRoot, 'node_modules', dep)

    await createDirectory(resolve(projectDir, 'node_modules'))
    if (dep.includes('@platformatic')) {
      await createDirectory(resolve(projectDir, 'node_modules', '@platformatic'))
    }
    // Symlink the dependency
    await symlink(resolved, moduleRoot, 'dir')
  }
}
