import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { getLogs, prepareRuntime, setFixturesDir, setLogFile, startRuntime } from '../../basic/test/helper.js'
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
    const { root, config } = await prepareRuntime(t, 'logger', envs[env].production, 'platformatic.json')
    await setLogFile(t, root)
    const { runtime, url } = await startRuntime(t, root, config, null, envs[env].build)

    await request(url + '/next')
    await request(url + '/next')

    const logs = await getLogs(runtime)

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
