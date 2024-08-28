import { createDirectory, safeRemove } from '@platformatic/utils'
import { execa } from 'execa'
import { minimatch } from 'minimatch'
import { fail, ok } from 'node:assert'
import { cp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { cliPath } from './helper.js'

async function packPackages (root, temporary) {
  const overrides = {}
  const packages = await readdir(resolve(root, 'packages'))

  const originalCwd = process.cwd()
  for (const pkg of packages) {
    if (pkg.startsWith('.')) {
      continue
    }

    let name = `@platformatic/${pkg}`

    if (pkg === 'cli') {
      name = 'platformatic'
    } else if (pkg === 'create-platformatic') {
      name = pkg
    }

    process.chdir(resolve(root, 'packages', pkg))
    const { stdout: path } = await execa('pnpm', ['pack', '--pack-destination', resolve(temporary, 'packages')])

    overrides[name] = pathToFileURL(path.trim()).toString()
  }

  process.chdir(originalCwd)
  return overrides
}

async function prepareService (root, temporary, subpath, overrides) {
  const serviceRoot = resolve(temporary, subpath)
  process.chdir(serviceRoot)
  await execa('pnpm', ['install'])

  const packageJson = JSON.parse(await readFile(resolve(serviceRoot, 'package.json'), 'utf-8'))
  packageJson.pnpm = { overrides }
  await writeFile(resolve(serviceRoot, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf-8')

  process.chdir(serviceRoot)
  await execa('pnpm', ['install', '--no-frozen-lockfile'])
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

let count = 0
test('should build all service that support the build command', async t => {
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const fixtures = fileURLToPath(new URL('./fixtures/deploy', import.meta.url))
  const temporary = resolve(tmpdir(), `test-cli-build-${process.pid}-${count++}`)

  await createDirectory(dirname(temporary))
  t.after(() => safeRemove(temporary))
  await cp(fixtures, temporary, { recursive: true })
  const overrides = await packPackages(root, temporary)

  await prepareService(root, temporary, '.', overrides)
  await Promise.all(
    [
      'services/astro',
      'services/db',
      'services/composer',
      'services/next',
      'services/node',
      'services/remix',
      'services/service',
      'services/vite'
    ].map(p => prepareService(root, temporary, p, overrides))
  )

  await execa('node', [cliPath, 'build'], { stdio: 'inherit', cwd: temporary })

  for (const pattern of [
    'services/astro/dist/index.html',
    'services/composer/dist/plugins/example.js',
    'services/composer/dist/routes/root.js',
    'services/db/dist/plugins/example.js',
    'services/db/dist/routes/root.js',
    'services/next/.next/build-manifest.json',
    'services/node/dist/pre/timestamp',
    'services/node/dist/index.js',
    'services/remix/build/client/assets/entry.client-*.js',
    'services/service/dist/plugins/example.js',
    'services/service/dist/routes/root.js',
    'services/vite/dist/index.html',
    'services/vite/dist/assets/index-*.js'
  ]) {
    await ensureExists(resolve(temporary, pattern))
  }
})
