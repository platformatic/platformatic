import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { test } from 'node:test'
import { defaultConfiguration, defaultPackageJson, defaultEnv } from '../lib/defaults.js'
import { gitignore } from '../lib/gitignore.js'
import { schema, version } from '../lib/schema.js'
import { createTemporaryDirectory, isDirectory, wattpm } from './helper.js'

test('init - should create a new application for NPM', async t => {
  const directory = await createTemporaryDirectory(t, 'init')
  await wattpm('init', directory)

  ok(isDirectory(resolve(directory, 'web')))

  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'watt.json'), 'utf-8')), {
    $schema: schema.$id,
    ...defaultConfiguration
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf-8')), {
    name: basename(directory),
    ...defaultPackageJson,
    dependencies: { wattpm: `^${version}` },
    workspaces: ['web/*', 'external/*']
  })

  strictEqual(await readFile(resolve(directory, '.gitignore'), 'utf-8'), gitignore)

  strictEqual(await readFile(resolve(directory, '.env'), 'utf-8'), defaultEnv)
  strictEqual(await readFile(resolve(directory, '.env.sample'), 'utf-8'), defaultEnv)
})

test('init - should create a new application for PNPM', async t => {
  const directory = await createTemporaryDirectory(t, 'init')
  await wattpm('init', '-p', 'pnpm', directory, 'entrypoint')

  ok(isDirectory(resolve(directory, 'web')))

  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'watt.json'), 'utf-8')), {
    $schema: schema.$id,
    ...defaultConfiguration,
    entrypoint: 'entrypoint'
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf-8')), {
    name: basename(directory),
    ...defaultPackageJson,
    dependencies: { wattpm: `^${version}` }
  })

  deepStrictEqual(await readFile(resolve(directory, 'pnpm-workspace.yaml'), 'utf-8'), 'packages:\n  - web/*\n  - external/*\n')

  strictEqual(await readFile(resolve(directory, '.env'), 'utf-8'), defaultEnv)
  strictEqual(await readFile(resolve(directory, '.env.sample'), 'utf-8'), defaultEnv)
})

test('init - should fail if the destination is a file', async t => {
  const result = await wattpm('init', import.meta.filename, { reject: false })

  deepStrictEqual(result.exitCode, 1)
  ok(result.stdout.includes(`Path ${import.meta.filename} exists but it is not a directory.`))
})

test('init - should fail if the destination web folder is a file', async t => {
  const directory = await createTemporaryDirectory(t, 'init')
  await writeFile(resolve(directory, 'web'), 'content')

  const result = await wattpm('init', directory, { reject: false })

  deepStrictEqual(result.exitCode, 1)
  ok(result.stdout.includes(`Path ${resolve(directory, 'web')} exists but it is not a directory.`))
})

for (const file of ['watt.json', 'package.json', '.gitignore']) {
  test(`init - should fail if the destination ${file} file exists`, async t => {
    const directory = await createTemporaryDirectory(t, 'init')
    await writeFile(resolve(directory, file), 'content')

    const result = await wattpm('init', directory, { reject: false })

    deepStrictEqual(result.exitCode, 1)
    ok(result.stdout.includes(`Path ${resolve(directory, file)} already exists.`))
  })
}
