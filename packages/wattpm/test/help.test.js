import { setExecutableId, setExecutableName } from '@platformatic/foundation'
import { deepStrictEqual, ok } from 'node:assert'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { showGeneralHelp } from '../lib/commands/help.js'
import { version } from '../lib/schema.js'
import { wattpm } from './helper.js'

test('help - should show proper messages', async t => {
  const mainProcess = await wattpm('help')
  const mainViaArgProcess = await wattpm('--help')
  const mainNoArgs = await wattpm()
  const commandHelpProcess = await wattpm('help', 'inject')
  const commandHelpShortArgProcess = await wattpm('inject', '-h')
  const commandHelpLongArgProcess = await wattpm('inject', '--help')

  ok(mainProcess.stdout.includes('\nUsage: wattpm [options] [command]'))
  ok(mainViaArgProcess.stdout.includes('\nUsage: wattpm [options] [command]'))
  ok(mainNoArgs.stdout.includes('\nUsage: wattpm [options] [command]'))
  ok(commandHelpProcess.stdout.startsWith('\nUsage: wattpm inject'))
  deepStrictEqual(commandHelpProcess.stdout, commandHelpShortArgProcess.stdout)
  deepStrictEqual(commandHelpProcess.stdout, commandHelpLongArgProcess.stdout)

  const metricsHelp = await wattpm('help', 'metrics')
  ok(metricsHelp.stdout.startsWith('\nUsage: wattpm metrics'))
})

test('help - should support embedding via API', async t => {
  const logs = []
  function logger (message) {
    logs.push(message)
  }

  setExecutableId('wattpm')
  setExecutableName('Watt')
  await showGeneralHelp(logger)
  const originalLogs = logs.splice(0, logs.length).join('\n')

  originalLogs.includes('Usage: wattpm [options] [command]')
  originalLogs.includes('Watt')

  setExecutableId('test-cli')
  setExecutableName('Test CLI')
  await showGeneralHelp(logger)
  const embeddedLogs = logs.splice(0, logs.length).join('\n')

  embeddedLogs.includes('Usage: test-cli [options] [command]')
  embeddedLogs.includes('Test CLI')

  setExecutableId('wattpm')
  setExecutableName('Watt')
  await showGeneralHelp(logger)
  const restoredLogs = logs.splice(0, logs.length).join('\n')

  deepStrictEqual(originalLogs, restoredLogs)
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
      'Unknown command whatever. Please run "wattpm help" to see available commands.'
    )
  )
  ok(
    invalidHelpProcess.stdout.includes('Unknown command whatever. Please run "wattpm help" to see available commands.')
  )
})

test('help - should support application commands', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.json')
  const mainProcess = await wattpm('help', { cwd: rootDir })
  const applicationHelpProcess = await wattpm('help', 'main:fetch-openapi-schemas', { cwd: rootDir })

  ok(mainProcess.stdout.includes('\nApplications Commands:'))
  ok(
    mainProcess.stdout
      .replaceAll(/ {2,}/g, '@')
      .includes('main:fetch-openapi-schemas@Fetch OpenAPI schemas from remote applications')
  )

  ok(
    applicationHelpProcess.stdout.match(
      '\nUsage: wattpm main:fetch-openapi-schemas\\s+Fetch OpenAPI schemas from remote applications.'
    )
  )
})
