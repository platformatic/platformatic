import { deepStrictEqual, ok } from 'node:assert'
import { test } from 'node:test'
import { version } from '../lib/schema.js'
import { wattpm } from './helper.js'

test('help - should show proper messages', async t => {
  const mainProcess = await wattpm('help')
  const mainViaArgProcess = await wattpm('--help')
  const commandHelpProcess = await wattpm('help', 'inject')
  const commandHelpShortArgProcess = await wattpm('inject', '-h')
  const commandHelpLongArgProcess = await wattpm('inject', '--help')

  ok(mainProcess.stdout.startsWith('\nUsage: wattpm [options] [command]'))
  ok(mainViaArgProcess.stdout.startsWith('\nUsage: wattpm [options] [command]'))
  ok(commandHelpProcess.stdout.startsWith('\nUsage: wattpm inject'))
  deepStrictEqual(commandHelpProcess.stdout, commandHelpShortArgProcess.stdout)
  deepStrictEqual(commandHelpProcess.stdout, commandHelpLongArgProcess.stdout)

  const metricsHelp = await wattpm('help', 'metrics')
  ok(metricsHelp.stdout.startsWith('\nUsage: wattpm metrics'))
})

test('help - should show the version', async t => {
  const versionProcess = await wattpm('-V')

  deepStrictEqual(versionProcess.stdout, version)
})

test('help - should complain for invalid commands', async t => {
  const invalidCommandProcess = await wattpm('whatever', { reject: false })
  const invalidHelpProcess = await wattpm('help', 'whatever', { reject: false })

  ok(
    invalidCommandProcess.stdout.includes(
      "Unknown command whatever. Please run 'wattpm help' to see available commands."
    )
  )
  ok(
    invalidHelpProcess.stdout.includes("Unknown command whatever. Please run 'wattpm help' to see available commands.")
  )
})
