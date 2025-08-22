import { execa } from 'execa'
import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'

test('platformatic - should be an alias for wattpm', async t => {
  const { stdout } = await execa(resolve(import.meta.dirname, '../bin/platformatic.js'), { env: { NO_COLOR: 'true' } })

  ok(stdout.includes('Usage: platformatic [options] [command]'))
  ok(stdout.includes('Welcome to Platformatic'))
})

test('plt - should be an alias for wattpm', async t => {
  const { stdout } = await execa(resolve(import.meta.dirname, '../bin/plt.js'), { env: { NO_COLOR: 'true' } })

  ok(stdout.includes('Usage: plt [options] [command]'))
  ok(stdout.includes('Welcome to Platformatic'))
})
