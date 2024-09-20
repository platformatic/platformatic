import { deepStrictEqual, ok } from 'node:assert'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { test } from 'node:test'
import { defaultConfiguration, defaultPackageJson } from '../lib/defaults.js'
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
    workspaces: ['web/*']
  })
})

test('init - should create a new application for PNPM', async t => {
  const directory = await createTemporaryDirectory(t, 'init')
  await wattpm('init', '-p', 'pnpm', directory)

  ok(isDirectory(resolve(directory, 'web')))

  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'watt.json'), 'utf-8')), {
    $schema: schema.$id,
    ...defaultConfiguration
  })

  deepStrictEqual(JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf-8')), {
    name: basename(directory),
    ...defaultPackageJson,
    dependencies: { wattpm: `^${version}` }
  })

  deepStrictEqual(await readFile(resolve(directory, 'pnpm-workspace.yaml'), 'utf-8'), `packages:\n  - 'web/*'`)
})

test('init - should fail if the destination is a file', async t => {
  const result = await wattpm('init', import.meta.filename, { reject: false })

  deepStrictEqual(result.exitCode, 1)
  ok(result.stdout.includes(`Path ${import.meta.filename} exists but it is not a directory.`))
})

test('init - should fail if the destination is not empty', async t => {
  const result = await wattpm('init', import.meta.dirname, { reject: false })

  deepStrictEqual(result.exitCode, 1)
  ok(result.stdout.includes(`Directory ${import.meta.dirname} is not empty.`))
})
