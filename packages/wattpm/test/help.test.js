import { deepStrictEqual, ok } from 'node:assert'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { version } from '../lib/schema.js'
import { wattpm } from './helper.js'

test('help - should show proper messages', async t => {
  const mainProcess = await wattpm('help')
  const mainViaArgProcess = await wattpm('--help')
  const mainNoArgs = await wattpm()
  const commandHelpProcess = await wattpm('help', 'inject')
  const commandHelpShortArgProcess = await wattpm('inject', '-h')
  const commandHelpLongArgProcess = await wattpm('inject', '--help')

  ok(mainProcess.stdout.startsWith('\nUsage: wattpm [options] [command]'))
  ok(mainViaArgProcess.stdout.startsWith('\nUsage: wattpm [options] [command]'))
  ok(mainNoArgs.stdout.startsWith('\nUsage: wattpm [options] [command]'))
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

test('help - should support service commands', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.json')
  const mainProcess = await wattpm('help', { cwd: rootDir })
  const serviceHelpProcess = await wattpm('help', 'main:fetch-openapi-schemas', { cwd: rootDir })

  ok(mainProcess.stdout.includes('\nServices Commands:'))
  ok(
    mainProcess.stdout
      .replaceAll(/ {2,}/g, '@')
      .includes('main:fetch-openapi-schemas@Fetch OpenAPI schemas from services')
  )

  ok(
    serviceHelpProcess.stdout.match(
      '\nUsage: wattpm main:fetch-openapi-schemas\\s+Fetch OpenAPI schemas from services.'
    )
  )
})
