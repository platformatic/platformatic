import { execa } from 'execa'
import { deepStrictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'

test('should be an alias for create-wattpm', async t => {
  const { stdout } = await execa(process.argv[0], [
    '--import',
    resolve(import.meta.dirname, './loader.js'),
    resolve(import.meta.dirname, '../bin/cli.js')
  ])

  deepStrictEqual(stdout.trim(), 'OK')
})
