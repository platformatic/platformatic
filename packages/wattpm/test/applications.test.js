import { ok } from 'node:assert'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

test('should execute applications commands', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.json')
  const applicationCommandProcess = await wattpm('main:fetch-openapi-schemas', { cwd: rootDir })

  ok(applicationCommandProcess.stdout.includes('Fetching schemas for all applications.'))
})

test('can show help for applications commands', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.json')
  const mainHelpProcess = await wattpm('help', { cwd: rootDir })
  const applicationHelpProcess = await wattpm('help', 'main:fetch-openapi-schemas', { cwd: rootDir })

  ok(mainHelpProcess.stdout.includes('\nApplications Commands:'))
  ok(
    mainHelpProcess.stdout
      .replaceAll(/ {2,}/g, '@')
      .includes('main:fetch-openapi-schemas@Fetch OpenAPI schemas from remote applications')
  )

  ok(
    applicationHelpProcess.stdout.match(
      '\nUsage: wattpm main:fetch-openapi-schemas\\s+Fetch OpenAPI schemas from remote applications'
    )
  )
})
