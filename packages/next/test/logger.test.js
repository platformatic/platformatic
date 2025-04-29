import { resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert'
import { request } from 'undici'
import {
  getLogs,
  prepareRuntime,
  setFixturesDir,
  startRuntime,
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
    process.env.PLT_RUNTIME_LOGGER_STDOUT = 1
    const { root, config } = await prepareRuntime(t, 'logger', envs[env].production, 'platformatic.json')
    const { runtime, url } = await startRuntime(t, root, config, null, envs[env].build)

    await request(url + '/next')
    await request(url + '/next')

    const logs = await getLogs(runtime)

    // logs from next app
    {
      const nextLog = logs.find(l => l.name === 'next' && l.msg.includes('Home page called'))
      const msgs = nextLog.msg.split('\n').find(l => l.includes('Home page called'))
      const log = JSON.parse(msgs)
      assert.ok(log.level === 'INFO' &&
        log.time.length === 24 &&
        log.bindings === 'custom' &&
        log.secret === '***HIDDEN***' &&
        log.msg === 'Home page called')
    }

    // logs from cache
    {
      const cacheLog = logs.find(l => l.name === 'next' && l.msg.includes('cache get'))
      const msgs = cacheLog.msg.split('\n').find(l => l.includes('cache get'))
      const log = JSON.parse(msgs)
      assert.ok(log.level === 'TRACE' &&
        log.time.length === 24 &&
        log.bindings === 'custom' &&
        log.msg === 'cache get')
    }
  })
}
