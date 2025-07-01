import { ok } from 'node:assert'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

test('should execute services commands', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.json')
  const serviceCommandProcess = await wattpm('main:fetch-openapi-schemas', { cwd: rootDir })

  ok(serviceCommandProcess.stdout.includes('Fetching schemas for all services.'))
})

test('can show help for services commands', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.json')
  const mainHelpProcess = await wattpm('help', { cwd: rootDir })
  const serviceHelpProcess = await wattpm('help', 'main:fetch-openapi-schemas', { cwd: rootDir })

  ok(mainHelpProcess.stdout.includes('\nServices Commands:'))
  ok(
    mainHelpProcess.stdout
      .replaceAll(/ {2,}/g, '@')
      .includes('main:fetch-openapi-schemas@Fetch OpenAPI schemas from services')
  )

  ok(
    serviceHelpProcess.stdout.match(
      '\nUsage: wattpm main:fetch-openapi-schemas\\s+Fetch OpenAPI schemas from services.'
    )
  )
})
