import { ok } from 'node:assert'
import { test } from 'node:test'
import { wattpm } from './helper.js'

test('scheduler help should document all commands', async () => {
  for (const command of ['scheduler', 'scheduler:pause', 'scheduler:resume', 'scheduler:run']) {
    const helpProcess = await wattpm('help', command)
    ok(helpProcess.stdout.startsWith(`\nUsage: wattpm ${command}`))
  }
})
