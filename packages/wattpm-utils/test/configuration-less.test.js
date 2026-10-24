import { deepStrictEqual } from 'node:assert'
import { readdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { test } from 'node:test'
import { changeWorkingDirectory, createTemporaryDirectory, wattpmUtils } from './helper.js'

// Inferred single-application projects do not need generated configuration files.
for (const command of ['install', 'resolve']) {
  test(`${command} - when no configuration file exists, should operate on the root and write nothing`, async t => {
    const rootDir = await createTemporaryDirectory(t, 'cli-build')
    await writeFile(resolve(rootDir, 'index.js'), '{}', 'utf-8')
    await writeFile(
      resolve(rootDir, 'package.json'),
      JSON.stringify({ name: basename(rootDir), version: '1.0.0' }),
      'utf-8'
    )

    changeWorkingDirectory(t, rootDir)
    const wattProcess = await wattpmUtils(command, '-P', 'npm')
    deepStrictEqual(wattProcess.exitCode, 0)

    // npm may write its own lockfile; configuration must not appear.
    const files = (await readdir(rootDir)).sort().filter(file => file !== 'package-lock.json')
    deepStrictEqual(files, ['index.js', 'package.json'])
  })
}
