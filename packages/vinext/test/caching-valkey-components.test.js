import Redis from 'iovalkey'
import { unpack } from 'msgpackr'
import { deepStrictEqual, notDeepStrictEqual, ok } from 'node:assert'
import { once } from 'node:events'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fixturesDir, getLogsFromFile, setFixturesDir } from '../../basic/test/helper.js'
import { keyFor } from '../../next/lib/caching/valkey-common.js'
import {
  base64ValueMatcher,
  cleanupCache,
  getValkeyUrl,
  prepareRuntimeWithBackend,
  setCacheSettings,
  valkeyPrefix,
  valkeyUser,
  verifyValkeySequence
} from '../../next/test/caching/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))
const configuration = 'caching-components'

test('should properly use the Valkey cache handler in production to cache pages', async t => {
  const { url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  const monitor = await valkey.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await monitor.disconnect()
    await valkey.disconnect()
  })

  let version
  let time
  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    ok(mo)

    version = mo[1]
    time = mo[2]
  }

  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)

    deepStrictEqual(mo[1], version)
    deepStrictEqual(mo[2], time)
  }

  const key = new RegExp('^' + keyFor(valkeyPrefix, '', 'components:values'))

  const storedValues = verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],
    ['get', key],
    ['get', key]
  ])

  const {
    value,
    meta: { applicationId, workerId },
    revalidate,
    tags,
    maxTTL
  } = unpack(Buffer.from(storedValues[0], 'base64url'))

  ok(typeof value, 'object')
  deepStrictEqual(tags, ['first', 'second', 'third'])
  deepStrictEqual(revalidate, 120)
  deepStrictEqual(maxTTL, 86400 * 7)
  deepStrictEqual(applicationId, 'frontend')
  deepStrictEqual(workerId, 0)
})

test('should properly use the Valkey cache handler in production to cache route handlers', async t => {
  const { url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  const monitor = await valkey.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await monitor.disconnect()
    await valkey.disconnect()
  })

  let version
  let time
  {
    const response = await fetch(url + '/route')
    const data = await response.json()

    version = data.version
    time = data.time
    ok(typeof version === 'number')
    ok(typeof time === 'number')
  }

  {
    const response = await fetch(url + '/route')
    const data = await response.json()

    deepStrictEqual(data.version, version)
    deepStrictEqual(data.time, time)
  }

  const key = new RegExp('^' + keyFor(valkeyPrefix, '', 'components:values'))

  const storedValues = verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],
    ['get', key]
  ])

  const {
    value,
    meta: { applicationId, workerId },
    revalidate,
    tags,
    maxTTL
  } = unpack(Buffer.from(storedValues[0], 'base64url'))

  ok(typeof value, 'object')
  deepStrictEqual(tags, ['first', 'second', 'third'])
  deepStrictEqual(revalidate, 120)
  deepStrictEqual(maxTTL, 86400 * 7)
  deepStrictEqual(applicationId, 'frontend')
  deepStrictEqual(workerId, 0)
})

test('should extend TTL when our limit is smaller than the user one', async t => {
  const { url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'], async root => {
    await setCacheSettings(root, cache => {
      cache.maxTTL = 20
    })
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  const monitor = await valkey.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await monitor.disconnect()
    await valkey.disconnect()
  })

  let version
  let time
  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    ok(mo)

    version = mo[1]
    time = mo[2]
  }

  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    deepStrictEqual(mo[1], version)
    deepStrictEqual(mo[2], time)
  }

  const key = new RegExp('^' + keyFor(valkeyPrefix, '', 'components:values'))
  const tagFirst = keyFor(valkeyPrefix, '', 'components:tags', 'first')
  const tagSecond = keyFor(valkeyPrefix, '', 'components:tags', 'second')
  const tagThird = keyFor(valkeyPrefix, '', 'components:tags', 'third')

  verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '20'],
    ['sadd', tagFirst, key],
    ['expire', tagFirst, '20'],
    ['sadd', tagSecond, key],
    ['expire', tagSecond, '20'],
    ['sadd', tagThird, key],
    ['expire', tagThird, '20'],

    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '20'],
    ['sadd', tagFirst, key],
    ['expire', tagFirst, '20'],
    ['sadd', tagSecond, key],
    ['expire', tagSecond, '20'],
    ['sadd', tagThird, key],
    ['expire', tagThird, '20'],

    ['get', key],
    ['expire', key, '20', 'gt'],
    ['expire', tagFirst, '20', 'gt'],
    ['expire', tagSecond, '20', 'gt'],
    ['expire', tagThird, '20', 'gt'],

    ['get', key],
    ['expire', key, '20', 'gt'],
    ['expire', tagFirst, '20', 'gt'],
    ['expire', tagSecond, '20', 'gt'],
    ['expire', tagThird, '20', 'gt']
  ])
})

test('should not extend the TTL over the original intended one', async t => {
  const { runtime, url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'], async root => {
    await setCacheSettings(root, cache => {
      cache.maxTTL = 10
    })

    const pageFile = await readFile(resolve('services/frontend/src/app/route/route.js'), 'utf-8')
    await writeFile(
      resolve('services/frontend/src/app/route/route.js'),
      pageFile.replace('revalidate: 120', 'revalidate: 11'),
      'utf-8'
    )
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  const monitor = await valkey.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await monitor.disconnect()
    await valkey.disconnect()
  })

  let version
  let time
  {
    const response = await fetch(url + '/route')
    const data = await response.json()
    await once(runtime, 'application:worker:event:completed')

    version = data.version
    time = data.time
    ok(typeof version === 'number')
    ok(typeof time === 'number')
  }

  {
    const response = await fetch(url + '/route?delay=3000')
    const data = await response.json()
    await once(runtime, 'application:worker:event:completed')

    deepStrictEqual(data.version, version)
    deepStrictEqual(data.time, time)
  }

  const key = new RegExp('^' + keyFor(valkeyPrefix, '', 'components:values'))

  verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '10'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '10'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '10'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '10'],

    ['set', key, base64ValueMatcher, 'EX', '10'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '10'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '10'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '10'],

    ['get', key],
    ['expire', key, '10', 'gt'],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '10', 'gt'],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '10', 'gt'],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '10', 'gt']
  ])
})

test('should handle deserialization error', async t => {
  const valkey1 = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  const valkey2 = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  const monitor = await valkey2.monitor()

  await cleanupCache(valkey1)

  t.after(async () => {
    await monitor.disconnect()
    await valkey1.disconnect()
    await valkey2.disconnect()
  })

  monitor.on('monitor', (_, args) => {
    if (args[0] === 'set' && args[2] !== 'invalid') {
      valkey1.set(args[1], 'invalid')
    }
  })

  const { root, url, runtime } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

  {
    const response = await fetch(url + '/route')
    notDeepStrictEqual((await response.json()).time, 0)
  }

  {
    const response = await fetch(url + '/route')
    notDeepStrictEqual((await response.json()).time, 0)
  }

  await runtime.close()
  const logs = await getLogsFromFile(root)

  ok(
    logs.find(l => {
      return (
        l.msg === 'Cannot deserialize cache value from Valkey' &&
        l.err?.message === 'Unexpected end of buffer reading string'
      )
    })
  )
})

test('should handle read error', async t => {
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO')

  const { root, url, runtime } = await prepareRuntimeWithBackend(
    t,
    configuration,
    true,
    false,
    ['frontend'],
    async root => {
      await setCacheSettings(root, cache => {
        cache.url = cache.url.replace('://', '://plt-caching-test@')
      })
    }
  )

  t.after(async () => {
    await valkey.acl('delUser', valkeyUser)
    await valkey.disconnect()
  })

  const response = await fetch(url + '/route')
  notDeepStrictEqual((await response.json()).time, 0)

  await runtime.close()
  const logs = await getLogsFromFile(root)

  ok(
    logs.find(l => {
      return (
        l.msg === 'Cannot read cache value from Valkey' &&
        l.err?.message === "NOPERM User plt-caching-test has no permissions to run the 'get' command"
      )
    })
  )
})

test('should handle refresh error', async t => {
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO', '+GET', '+SET', '+SADD', '+EXPIRE')

  const { root, url, runtime } = await prepareRuntimeWithBackend(
    t,
    configuration,
    true,
    false,
    ['frontend'],
    async root => {
      await setCacheSettings(root, cache => {
        cache.url = cache.url.replace('://', '://plt-caching-test@')
        cache.maxTTL = 10
      })
    }
  )

  t.after(async () => {
    await valkey.acl('delUser', valkeyUser)
    await valkey.disconnect()
  })

  {
    const response = await fetch(url + '/route')
    notDeepStrictEqual((await response.json()).time, 0)
  }

  await valkey.acl('deluser', valkeyUser)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO', '+GET', '+SET', '-EXPIRE')

  {
    const response = await fetch(url + '/route')
    notDeepStrictEqual((await response.json()).time, 0)
  }

  await runtime.close()
  const logs = await getLogsFromFile(root)

  ok(
    logs.find(l => {
      return (
        l.msg === 'Cannot refresh cache key expiration in Valkey' &&
        l.err?.message === "NOPERM User plt-caching-test has no permissions to run the 'expire' command"
      )
    })
  )
})

test('should handle write error', async t => {
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO', '+GET', '-SET')

  const { root, url, runtime } = await prepareRuntimeWithBackend(
    t,
    configuration,
    true,
    false,
    ['frontend'],
    async root => {
      await setCacheSettings(root, cache => {
        cache.url = cache.url.replace('://', '://plt-caching-test@')
      })
    }
  )

  t.after(async () => {
    await valkey.acl('delUser', valkeyUser)
    await valkey.disconnect()
  })

  const response = await fetch(url + '/route')
  notDeepStrictEqual((await response.json()).time, 0)

  await runtime.close()
  const logs = await getLogsFromFile(root)

  ok(
    logs.find(l => {
      return (
        l.msg === 'Cannot write cache value in Valkey' &&
        l.err?.message === "NOPERM User plt-caching-test has no permissions to run the 'set' command"
      )
    })
  )
})

test('should track Vinext cache hit and miss ratio in Prometheus', async t => {
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)

  t.after(async () => {
    await valkey.disconnect()
  })

  let version
  let time
  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    ok(mo)

    version = mo[1]
    time = mo[2]
  }

  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    deepStrictEqual(mo[1], version)
    deepStrictEqual(mo[2], time)
  }

  const { metrics } = await runtime.getMetrics('json')

  const cacheHit = metrics.find(m => m.name === 'vinext_components_cache_valkey_hit_count')
  const cacheMiss = metrics.find(m => m.name === 'vinext_components_cache_valkey_miss_count')

  deepStrictEqual(cacheHit.values[0].value, 2) // Two for the page (second request)
  deepStrictEqual(cacheMiss.values[0].value, 2) // Two for the page (first request)
})

test('should properly use the Valkey cache handler in production when using next.config.ts', async t => {
  const { url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'], async () => {
    await rename(resolve('services/frontend/next.config.mjs'), resolve('services/frontend/next.config.ts'))
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  const monitor = await valkey.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await monitor.disconnect()
    await valkey.disconnect()
  })

  let version
  let time
  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    ok(mo)

    version = mo[1]
    time = mo[2]
  }

  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)

    deepStrictEqual(mo[1], version)
    deepStrictEqual(mo[2], time)
  }

  const key = new RegExp('^' + keyFor(valkeyPrefix, '', 'components:values'))

  const storedValues = verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],
    ['get', key],
    ['get', key]
  ])

  const {
    value,
    meta: { applicationId, workerId },
    revalidate,
    tags,
    maxTTL
  } = unpack(Buffer.from(storedValues[0], 'base64url'))

  ok(typeof value, 'object')
  deepStrictEqual(tags, ['first', 'second', 'third'])
  deepStrictEqual(revalidate, 120)
  deepStrictEqual(maxTTL, 86400 * 7)
  deepStrictEqual(applicationId, 'frontend')
  deepStrictEqual(workerId, 0)
})

test('should properly revalidate tags in Valkey', async t => {
  const { runtime, url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  const monitor = await valkey.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await monitor.disconnect()
    await valkey.disconnect()
  })

  let version
  let time
  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    ok(mo)

    version = mo[1]
    time = mo[2]
  }

  {
    const res = await fetch(url + '/revalidate')
    ok(res.status, 200)
  }

  await once(runtime, 'application:worker:event:revalidated')

  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    notDeepStrictEqual(mo[1], version)
    notDeepStrictEqual(mo[2], time)
  }

  const key = new RegExp('^' + keyFor(valkeyPrefix, '', 'components:values'))

  verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],

    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],

    ['sscan', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '0'],
    ['sscan', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '0'],
    ['sscan', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '0'],
    ['del', key, key],
    ['del', key, key],
    ['del', key, key],
    ['del', keyFor(valkeyPrefix, '', 'components:tags', 'first')],
    ['del', keyFor(valkeyPrefix, '', 'components:tags', 'second')],
    ['del', keyFor(valkeyPrefix, '', 'components:tags', 'third')],

    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120'],

    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, '', 'components:tags', 'third'), '120']
  ])
})
