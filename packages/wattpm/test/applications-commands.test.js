import { ok } from 'node:assert'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

test('should execute applications commands', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.config.mjs')
  const applicationCommandProcess = await wattpm('main:fetch-openapi-schemas', { cwd: rootDir })

  ok(applicationCommandProcess.stdout.includes('Fetching schemas for all applications.'))
})

test('should execute applications commands with an explicit configuration file via --config', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.config.mjs')

  /*
    What this asserts in v4 is that `--config` is honoured, and no longer that it rescues a file
    discovery could not find. It used to rename the configuration to something arbitrary, which v3
    accepted; v4's `--config` names *where* a configuration is and not what it may be called, so a
    file in the project root under one of the four names is always discoverable and there is no
    name that is both legal and hidden.

    A name outside the four is refused rather than loaded, which the loader's own tests cover.
  */
  const applicationCommandProcess = await wattpm('main:fetch-openapi-schemas', '--config', 'watt.config.mjs', {
    cwd: rootDir
  })

  ok(applicationCommandProcess.stdout.includes('Fetching schemas for all applications.'))
})

test('can show help for applications commands', async t => {
  const { root: rootDir } = await prepareRuntime(t, 'help', false, 'watt.config.mjs')
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
