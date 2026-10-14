import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { test } from 'node:test'
import { showGeneralHelp } from '../lib/commands/help.js'
import { version } from '../lib/version.js'
import { wattpmUtils } from './helper.js'

test('help - should show proper messages', async t => {
  const mainProcess = await wattpmUtils('help')
  const mainViaArgProcess = await wattpmUtils('--help')
  const mainNoArgs = await wattpmUtils()
  const commandHelpProcess = await wattpmUtils('help', 'resolve')
  const commandHelpShortArgProcess = await wattpmUtils('resolve', '-h')
  const commandHelpLongArgProcess = await wattpmUtils('resolve', '--help')

  ok(mainProcess.stdout.includes('\nUsage: wattpm-utils [options] [command]'))
  ok(mainViaArgProcess.stdout.includes('\nUsage: wattpm-utils [options] [command]'))
  ok(mainNoArgs.stdout.includes('\nUsage: wattpm-utils [options] [command]'))
  ok(commandHelpProcess.stdout.startsWith('\nUsage: wattpm-utils resolve'))
  deepStrictEqual(commandHelpProcess.stdout, commandHelpShortArgProcess.stdout)
  deepStrictEqual(commandHelpProcess.stdout, commandHelpLongArgProcess.stdout)

  const metricsHelp = await wattpmUtils('help', 'install')
  ok(metricsHelp.stdout.startsWith('\nUsage: wattpm-utils install'))
})

test('help - should support embedding via API', async t => {
  const logs = []
  function logger (message) {
    logs.push(message)
  }

  await showGeneralHelp({ executableId: 'wattpm', executableName: 'Watt' }, logger)
  const originalLogs = logs.splice(0, logs.length).join('\n')

  originalLogs.includes('Usage: wattpm [options] [command]')
  originalLogs.includes('Watt')

  await showGeneralHelp({ executableId: 'test-cli', executableName: 'Test CLI' }, logger)
  const embeddedLogs = logs.splice(0, logs.length).join('\n')

  embeddedLogs.includes('Usage: test-cli [options] [command]')
  embeddedLogs.includes('Test CLI')

  await showGeneralHelp({ executableId: 'wattpm', executableName: 'Watt' }, logger)
  const restoredLogs = logs.splice(0, logs.length).join('\n')

  deepStrictEqual(originalLogs, restoredLogs)
})

test('help - should show the version', async t => {
  const versionProcess = await wattpmUtils('-V')

  deepStrictEqual(versionProcess.stdout, version)
})

test('help - should complain for invalid commands', async t => {
  const invalidCommandProcess = await wattpmUtils('whatever', { reject: false })
  const invalidHelpProcess = await wattpmUtils('help', 'whatever', { reject: false })

  ok(
    invalidCommandProcess.stdout.includes(
      'Unknown command whatever. Please run "wattpm-utils help" to see available commands.'
    )
  )
  ok(
    invalidHelpProcess.stdout.includes(
      'Unknown command whatever. Please run "wattpm-utils help" to see available commands.'
    )
  )
})

test('help - removed scaffolding commands are not available', async () => {
  for (const command of ['create', 'init', 'add', 'import']) {
    const result = await wattpmUtils(command, { reject: false })
    strictEqual(result.exitCode, 1)
    ok(result.stdout.includes(`Unknown command ${command}`))
  }

  const help = await wattpmUtils('help')
  ok(!help.stdout.includes('Imports an external resource'))
  ok(!help.stdout.includes('Creates a new Watt project'))
  ok(help.stdout.includes('resolve [root]'))
})
