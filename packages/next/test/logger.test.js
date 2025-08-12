import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import {
  LOGS_TIMEOUT,
  getLogsFromFile,
  prepareRuntime,
  setFixturesDir,
  sleep,
  startRuntime
} from '../../basic/test/helper.js'
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

const envs = {
  dev: {
    production: false
  },
  prod: {
    production: true,
    build: ['next']
  }
}

for (const env of Object.keys(envs)) {
  test(`logger options, ${env}`, async t => {
    const { runtime, root } = await prepareRuntime(t, 'logger', envs[env].production, 'platformatic.json')
    const url = await startRuntime(t, runtime, null, envs[env].build)

    await request(url + '/next')
    await request(url + '/next')

    // Wait for logs to be flushed
    await sleep(LOGS_TIMEOUT)
    const logs = await getLogsFromFile(root)

    // logs from next app
    assert.ok(
      logs.find(log => {
        return (
          log.stdout &&
          log.stdout.level === 'INFO' &&
          log.stdout.time.length === 24 &&
          log.stdout.bindings === 'custom' &&
          log.stdout.secret === '***HIDDEN***' &&
          log.stdout.msg === 'Home page called'
        )
      })
    )

    // logs from cache
    assert.ok(
      logs.find(log => {
        return (
          log.stdout &&
          log.stdout.level === 'TRACE' &&
          log.stdout.time.length === 24 &&
          log.stdout.bindings === 'custom' &&
          log.stdout.msg === 'cache get'
        )
      })
    )
  })
}
