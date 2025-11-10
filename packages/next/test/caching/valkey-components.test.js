import Redis from 'iovalkey'
import { unpack } from 'msgpackr'
import { deepStrictEqual, notDeepStrictEqual, ok } from 'node:assert'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fixturesDir, getLogsFromFile, isCIOnWindows, setFixturesDir } from '../../../basic/test/helper.js'
import { keyFor } from '../../lib/caching/valkey-common.js'
import {
  base64ValueMatcher,
  cleanupCache,
  getValkeyUrl,
  prepareRuntimeWithBackend,
  setCacheSettings,
  valkeyPrefix,
  valkeyUser,
  verifyValkeySequence
} from './helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, '../fixtures'))
const configuration = 'caching-components'

test('should properly use the Valkey cache handler in production to cache pages', { skip: isCIOnWindows }, async t => {
  const { root, url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

  const prefix = await readFile(resolve(root, 'services/frontend/.next/BUILD_ID'), 'utf-8')
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

  const key = new RegExp('^' + keyFor(valkeyPrefix, prefix, 'components:values'))

  const storedValues = verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), '120'],
    ['get', key]
  ])

  const {
    maxTTL,
    meta: { applicationId, workerId },
    value,
    revalidate,
    expire,
    stale,
    tags
  } = unpack(Buffer.from(storedValues[0], 'base64url'))

  deepStrictEqual(
    value.toString(),
    `0:"$@1"\n1:["$","div",null,{"children":["Hello from v",${version}," t",${time}]}]\n`
  )
  deepStrictEqual(tags, ['first', 'second', 'third'])
  deepStrictEqual(expire, 4294967294)
  deepStrictEqual(stale, 300)
  deepStrictEqual(revalidate, 120)
  deepStrictEqual(maxTTL, 86400 * 7)
  deepStrictEqual(applicationId, 'frontend')
  deepStrictEqual(workerId, 0)
})

test(
  'should properly use the Valkey cache handler in production to cache route handlers',
  { skip: isCIOnWindows },
  async t => {
    const { url, root } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

    const prefix = await readFile(resolve(root, 'services/frontend/.next/BUILD_ID'), 'utf-8')
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

    const key = new RegExp('^' + keyFor(valkeyPrefix, prefix, 'components:values'))

    const storedValues = verifyValkeySequence(valkeyCalls, [
      ['get', key],
      ['set', key, base64ValueMatcher, 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), key],
      ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), key],
      ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), key],
      ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), '120'],
      ['get', key]
    ])

    const {
      maxTTL,
      meta: { applicationId, workerId },
      value,
      revalidate,
      expire,
      stale,
      tags
    } = unpack(Buffer.from(storedValues[0], 'base64url'))

    deepStrictEqual(value.toString(), `0:"$@1"\n1:{"delay":0,"version":${version},"time":${time}}\n`)
    deepStrictEqual(tags, ['first', 'second', 'third'])
    deepStrictEqual(expire, 4294967294)
    deepStrictEqual(stale, 300)
    deepStrictEqual(revalidate, 120)
    deepStrictEqual(maxTTL, 86400 * 7)
    deepStrictEqual(applicationId, 'frontend')
    deepStrictEqual(workerId, 0)
  }
)

test('should extend TTL when our limit is smaller than the user one', { skip: isCIOnWindows }, async t => {
  const { root, url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'], async root => {
    await setCacheSettings(root, cache => {
      cache.maxTTL = 20
    })
  })

  const prefix = await readFile(resolve(root, 'services/frontend/.next/BUILD_ID'), 'utf-8')
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

  const key = new RegExp('^' + keyFor(valkeyPrefix, prefix, 'components:values'))

  verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '20'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), '20'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), '20'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), '20'],
    ['get', key],
    ['expire', key, '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), '20', 'gt']
  ])
})

test('should not extend the TTL over the original intended one', { skip: isCIOnWindows }, async t => {
  const { root, url } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'], async root => {
    await setCacheSettings(root, cache => {
      cache.maxTTL = 10
    })

    const pageFile = await readFile(resolve(root, 'services/frontend/src/app/route/route.js'), 'utf-8')
    await writeFile(
      resolve(root, 'services/frontend/src/app/route/route.js'),
      pageFile.replace('revalidate: 120', 'revalidate: 11'),
      'utf-8'
    )
  })

  const prefix = await readFile(resolve(root, 'services/frontend/.next/BUILD_ID'), 'utf-8')
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
    const response = await fetch(url + '/route?delay=3000')
    const data = await response.json()

    notDeepStrictEqual(data.version, version)
    notDeepStrictEqual(data.time, time)
  }

  const key = new RegExp('^' + keyFor(valkeyPrefix, prefix, 'components:values'))

  verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '10'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), '10'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), '10'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), '10'],
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '10'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), '10'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), '10'],
    ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), '10']
  ])
})

test('should handle deserialization error', { skip: isCIOnWindows }, async t => {
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

  const { url, root, runtime } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

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

test('should handle read error', { skip: isCIOnWindows }, async t => {
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO')

  const { url, root, runtime } = await prepareRuntimeWithBackend(
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

test('should handle refresh error', { skip: isCIOnWindows }, async t => {
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO', '+GET', '+SET', '+SADD', '+EXPIRE')

  const { url, root, runtime } = await prepareRuntimeWithBackend(
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

test('should handle write error', { skip: isCIOnWindows }, async t => {
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO', '+GET', '-SET')

  const { url, root, runtime } = await prepareRuntimeWithBackend(
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

test('should track Next.js cache hit and miss ratio in Prometheus', { skip: isCIOnWindows }, async t => {
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

  const cacheHit = metrics.find(m => m.name === 'next_components_cache_valkey_hit_count')
  const cacheMiss = metrics.find(m => m.name === 'next_components_cache_valkey_miss_count')

  deepStrictEqual(cacheHit.values[0].value, 1) // One for the page (second request)
  deepStrictEqual(cacheMiss.values[0].value, 1) // One for the page (first request)
})

test(
  'should properly use the Valkey cache handler in production when using next.config.ts',
  { skip: isCIOnWindows },
  async t => {
    const { url, root } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'], async root => {
      await rename(
        resolve(root, 'services/frontend/next.config.mjs'),
        resolve(root, 'services/frontend/next.config.ts')
      )
    })

    const prefix = await readFile(resolve(root, 'services/frontend/.next/BUILD_ID'), 'utf-8')
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

    const key = new RegExp('^' + keyFor(valkeyPrefix, prefix, 'components:values'))

    const storedValues = verifyValkeySequence(valkeyCalls, [
      ['get', key],
      ['set', key, base64ValueMatcher, 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), key],
      ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), key],
      ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), key],
      ['expire', keyFor(valkeyPrefix, prefix, 'components:tags', 'third'), '120'],
      ['get', key]
    ])

    const {
      maxTTL,
      meta: { applicationId, workerId },
      value,
      revalidate,
      expire,
      stale,
      tags
    } = unpack(Buffer.from(storedValues[0], 'base64url'))

    deepStrictEqual(
      value.toString(),
      `0:"$@1"\n1:["$","div",null,{"children":["Hello from v",${version}," t",${time}]}]\n`
    )
    deepStrictEqual(tags, ['first', 'second', 'third'])
    deepStrictEqual(expire, 4294967294)
    deepStrictEqual(stale, 300)
    deepStrictEqual(revalidate, 120)
    deepStrictEqual(maxTTL, 86400 * 7)
    deepStrictEqual(applicationId, 'frontend')
    deepStrictEqual(workerId, 0)
  }
)
