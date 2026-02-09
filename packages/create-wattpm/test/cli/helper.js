import { createDirectory, safeRemove } from '@platformatic/foundation'
import { execa } from 'execa'
import { promises as fs } from 'node:fs'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { platform, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const isWindows = platform() === 'win32'
const pltCreatePath = fileURLToPath(new URL('../../bin/cli.js', import.meta.url))
const pltRoot = fileURLToPath(new URL('../..', import.meta.url))
let tmpCount = 0

export async function getApplications (dir) {
  const files = await fs.readdir(dir)
  const applications = []
  for (const file of files) {
    applications.push(file)
  }
  return applications
}

export async function createTemporaryDirectory (t, prefix) {
  const directory = join(tmpdir(), `test-create-wattpm-${prefix}-${process.pid}-${tmpCount++}`)

  t.after(async () => {
    await safeRemove(directory)
  })

  await mkdir(directory)
  return directory
}

export async function setupUserInputHandler (t, expected) {
  const temporaryFolder = await createTemporaryDirectory(t, 'inquirer')
  let inputHandler = resolve(temporaryFolder, 'input-handler.js')

  const template = await readFile(new URL('../fixtures/input-handler.js', import.meta.url), 'utf-8')

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

  const execaOptions = {
    cwd: dir,
    env: {
      NO_COLOR: 'true',
      PLT_MODULES_PATHS: JSON.stringify({ '@platformatic/vite': resolve(pltRoot, '../vite') }),
      PLT_USER_INPUT_HANDLER: options.userInputHandler
    }
  }

  if (pkgManager === 'pnpm') {
    execaOptions.env.npm_config_user_agent = 'pnpm/6.14.1 npm/? node/v16.4.2 darwin x64'
  }

  const child = execa(
    'node',
    [pltCreatePath, `--install=${pkgMgrInstall.toString()}`, ...(options.args ?? [])],
    execaOptions
  )

  return child
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
