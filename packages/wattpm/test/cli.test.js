import { safeRemove } from '@platformatic/utils'
import { ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { prepareRuntime } from '../../basic/test/helper.js'
import { wattpm } from './helper.js'

for (const command of ['build', 'install', 'update', 'start', 'dev', 'import', 'resolve', 'patch-config']) {
  test(`CLI - ${command} - should fail when it cannot find a configuration file`, async t => {
    const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
    await safeRemove(resolve(buildDir, 'watt.json'))

    const wattProcess = await wattpm(command, buildDir, { reject: false })
    ok(wattProcess.stdout.includes('Cannot find a supported Watt configuration file'))
  })
}

test('CLI - import / fixConfiguration - should fail when it cannot find a configuration file', async t => {
  const { root: buildDir } = await prepareRuntime(t, 'build', false, 'watt.json')
  await safeRemove(resolve(buildDir, 'watt.json'))

  const wattProcess = await wattpm('import', { reject: false })
  ok(wattProcess.stdout.includes('Cannot find a supported Watt configuration file'))
})
