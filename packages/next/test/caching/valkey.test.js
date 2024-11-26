import { ConfigManager } from '@platformatic/config'
import Redis from 'iovalkey'
import { unpack } from 'msgpackr'
import { deepStrictEqual, notDeepStrictEqual, ok } from 'node:assert'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import {
  commonFixturesRoot,
  fixturesDir,
  getLogs,
  isCIOnWindows,
  prepareRuntime,
  setFixturesDir,
  startRuntime
} from '../../../basic/test/helper.js'
import { keyFor } from '../../lib/caching/valkey.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, '../fixtures'))

async function prepareRuntimeWithBackend (
  t,
  configuration,
  production = false,
  pauseAfterCreation = false,
  servicesToBuild = false,
  additionalSetup = null
) {
  const { root, config } = await prepareRuntime(t, configuration, production, null, async (root, config, args) => {
    await cp(resolve(commonFixturesRoot, 'backend-js'), resolve(root, 'services/backend'), {
      recursive: true
    })

    await additionalSetup?.(root, config, args)
  })

  return startRuntime(t, root, config, pauseAfterCreation, servicesToBuild)
}

async function cleanupCache (valkey) {
  const keys = await valkey.keys(keyFor('plt:test:caching-valkey', '*'))

  if (keys.length === 0) {
    return
  }

  return valkey.del(...keys)
}

async function getCacheSettings (root) {
  const configManager = new ConfigManager({
    source: resolve(root, 'services/frontend/platformatic.json')
  })
  await configManager.parse()
  return configManager.current.cache
}

async function setCacheSettings (root, settings) {
  const configManager = new ConfigManager({
    source: resolve(root, 'services/frontend/platformatic.json')
  })
  await configManager.parse()

  const config = configManager.current

  if (typeof settings === 'function') {
    settings(config.cache)
  } else {
    Object.assign(config.cache, settings)
  }

  await writeFile(resolve(root, 'services/frontend/platformatic.json'), JSON.stringify(config))
}

async function getValkeyUrl (root) {
  return (await getCacheSettings(root)).url
}

test(
  'should properly use the Valkey cache handler in development to cache fetch calls but not pages',
  { skip: isCIOnWindows },
  async t => {
    const configuration = 'caching-valkey'
    const valkeyPrefix = 'plt:test:caching-valkey'
    const { url } = await prepareRuntimeWithBackend(t, configuration)

    const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
    await cleanupCache(valkey, valkeyPrefix)
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
      notDeepStrictEqual(mo[1], version)
      deepStrictEqual(mo[2], time)
    }

    const key = keyFor(
      valkeyPrefix,
      'development',
      'values',
      // This might change in different versions of Next.js, keep in sync
      '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
    )
    deepStrictEqual(valkeyCalls, [
      ['info'],
      ['get', key],
      ['set', key, valkeyCalls[2][2], 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '120'],
      ['info'],
      ['get', key]
    ])

    const {
      value: {
        kind,
        data: { body, status, url: cachedUrl },
        revalidate: revalidateNext
      },
      tags,
      revalidate: revalidatePlt,
      maxTTL
    } = unpack(Buffer.from(valkeyCalls[2][2], 'base64url'))

    deepStrictEqual(kind, 'FETCH')
    deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
    deepStrictEqual(status, 200)
    deepStrictEqual(cachedUrl, 'http://backend.plt.local/time')
    deepStrictEqual(tags, ['first', 'second', 'third'])
    deepStrictEqual(revalidateNext, 120)
    deepStrictEqual(revalidatePlt, 120)
    deepStrictEqual(maxTTL, 86400 * 7)
  }
)

test(
  'should properly use the Valkey cache handler in production to cache fetch calls and pages',
  { skip: isCIOnWindows },
  async t => {
    const configuration = 'caching-valkey'
    const valkeyPrefix = 'plt:test:caching-valkey'
    const { url, root } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

    const prefix = await readFile(resolve(root, 'services/frontend/.next/BUILD_ID'), 'utf-8')
    const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
    await cleanupCache(valkey, valkeyPrefix)
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

    const pageKey = keyFor(valkeyPrefix, prefix, 'values', '/index')

    const fetchKey = keyFor(
      valkeyPrefix,
      prefix,
      'values',
      // This might change in different versions of Next.js, keep in sync
      '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
    )

    deepStrictEqual(valkeyCalls, [
      ['info'],
      ['get', pageKey],
      ['get', fetchKey],
      ['set', fetchKey, valkeyCalls[3][2], 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'first'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'second'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'third'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'third'), '120'],
      ['get', fetchKey],
      ['set', pageKey, valkeyCalls[11][2], 'EX', '120'],
      ['info'],
      ['get', pageKey]
    ])

    {
      const {
        value: {
          kind,
          data: { body, status, url: cachedUrl },
          revalidate: revalidateNext
        },
        tags,
        revalidate: revalidatePlt,
        maxTTL
      } = unpack(Buffer.from(valkeyCalls[3][2], 'base64url'))

      deepStrictEqual(kind, 'FETCH')
      deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
      deepStrictEqual(status, 200)
      deepStrictEqual(cachedUrl, 'http://backend.plt.local/time')
      deepStrictEqual(tags, ['first', 'second', 'third'])
      deepStrictEqual(revalidateNext, 120)
      deepStrictEqual(revalidatePlt, 120)
      deepStrictEqual(maxTTL, 86400 * 7)
    }

    {
      const {
        value: { kind, html, headers, status },
        revalidate,
        maxTTL
      } = unpack(Buffer.from(valkeyCalls[11][2], 'base64url'))

      deepStrictEqual(kind, 'PAGE')
      ok(html.includes(`<div>Hello from v<!-- -->${version}<!-- --> t<!-- -->${time}</div>`))
      deepStrictEqual(headers['x-next-cache-tags'], 'first,second,third,_N_T_/layout,_N_T_/page,_N_T_/')
      deepStrictEqual(status, 200)
      deepStrictEqual(revalidate, 120)
      deepStrictEqual(maxTTL, 86400 * 7)
    }
  }
)

test(
  'should properly use the Valkey cache handler in development to cache fetch calls but not route handler',
  { skip: isCIOnWindows },
  async t => {
    const configuration = 'caching-valkey'
    const valkeyPrefix = 'plt:test:caching-valkey'
    const { url } = await prepareRuntimeWithBackend(t, configuration, false)

    const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
    await cleanupCache(valkey, valkeyPrefix)
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

      notDeepStrictEqual(data.version, version)
      deepStrictEqual(data.time, time)
    }

    const key = keyFor(
      valkeyPrefix,
      'development',
      'values',
      // This might change in different versions of Next.js, keep in sync
      '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
    )
    deepStrictEqual(valkeyCalls, [
      ['info'],
      ['get', key],
      ['set', key, valkeyCalls[2][2], 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '120'],
      ['info'],
      ['get', key]
    ])

    const {
      value: {
        kind,
        data: { body, status, url: cachedUrl },
        revalidate: revalidateNext
      },
      tags,
      revalidate: revalidatePlt,
      maxTTL
    } = unpack(Buffer.from(valkeyCalls[2][2], 'base64url'))

    deepStrictEqual(kind, 'FETCH')
    deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
    deepStrictEqual(status, 200)
    deepStrictEqual(cachedUrl, 'http://backend.plt.local/time')
    deepStrictEqual(tags, ['first', 'second', 'third'])
    deepStrictEqual(revalidateNext, 120)
    deepStrictEqual(revalidatePlt, 120)
    deepStrictEqual(maxTTL, 86400 * 7)
  }
)

test(
  'should properly use the Valkey cache handler in production to cache fetch calls and route handler',
  { skip: isCIOnWindows },
  async t => {
    const configuration = 'caching-valkey'
    const valkeyPrefix = 'plt:test:caching-valkey'
    const { url, root } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

    const prefix = await readFile(resolve(root, 'services/frontend/.next/BUILD_ID'), 'utf-8')
    const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
    await cleanupCache(valkey, valkeyPrefix)
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

    const routeKey = keyFor(valkeyPrefix, prefix, 'values', '/route')

    const fetchKey = keyFor(
      valkeyPrefix,
      prefix,
      'values',
      // This might change in different versions of Next.js, keep in sync
      '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
    )

    deepStrictEqual(valkeyCalls, [
      ['info'],
      ['get', routeKey],
      ['get', fetchKey],
      ['set', fetchKey, valkeyCalls[3][2], 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'first'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'second'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'third'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'third'), '120'],
      ['set', routeKey, valkeyCalls[10][2], 'EX', '120'],
      ['info'],
      ['get', routeKey]
    ])

    {
      const {
        value: {
          kind,
          data: { body, status, url: cachedUrl },
          revalidate: revalidateNext
        },
        tags,
        revalidate: revalidatePlt,
        maxTTL
      } = unpack(Buffer.from(valkeyCalls[3][2], 'base64url'))

      deepStrictEqual(kind, 'FETCH')
      deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
      deepStrictEqual(status, 200)
      deepStrictEqual(cachedUrl, 'http://backend.plt.local/time')
      deepStrictEqual(tags, ['first', 'second', 'third'])
      deepStrictEqual(revalidateNext, 120)
      deepStrictEqual(revalidatePlt, 120)
      deepStrictEqual(maxTTL, 86400 * 7)
    }

    {
      const {
        value: { kind, body, headers, status },
        revalidate,
        maxTTL
      } = unpack(Buffer.from(valkeyCalls[10][2], 'base64url'))

      deepStrictEqual(kind, 'ROUTE')
      deepStrictEqual({ ...JSON.parse(body), delay: 0 }, { delay: 0, version, time })
      deepStrictEqual(headers['x-next-cache-tags'], 'first,second,third,_N_T_/layout,_N_T_/route,_N_T_/route/route')
      deepStrictEqual(status, 200)
      deepStrictEqual(revalidate, 120)
      deepStrictEqual(maxTTL, 86400 * 7)
    }
  }
)

test('should properly revalidate tags in Valkey', { skip: isCIOnWindows }, async t => {
  const configuration = 'caching-valkey'
  const valkeyPrefix = 'plt:test:caching-valkey'
  const { url } = await prepareRuntimeWithBackend(t, configuration)

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey, valkeyPrefix)
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

  {
    const response = await fetch(url)
    const data = await response.text()

    const mo = data.match(/<div>Hello from v<!-- -->(.+)<!-- --> t<!-- -->(.+)<\/div>/)
    notDeepStrictEqual(mo[1], version)
    notDeepStrictEqual(mo[2], time)
  }

  const key = keyFor(
    valkeyPrefix,
    'development',
    'values',
    // This might change in different versions of Next.js, keep in sync
    '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
  )

  deepStrictEqual(valkeyCalls, [
    ['info'],
    ['get', key],
    ['set', key, valkeyCalls[2][2], 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '120'],
    ['info'],
    ['sscan', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '0'],
    ['del', key],
    ['del', keyFor(valkeyPrefix, 'development', 'tags', 'first')],
    ['sscan', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '0'],
    ['del', key],
    ['del', keyFor(valkeyPrefix, 'development', 'tags', 'second')],
    ['sscan', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '0'],
    ['del', key],
    ['del', keyFor(valkeyPrefix, 'development', 'tags', 'third')],
    ['info'],
    ['get', key],
    ['set', key, valkeyCalls[21][2], 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '120']
  ])
})

test('should extend TTL when our limit is smaller than the user one', { skip: isCIOnWindows }, async t => {
  const configuration = 'caching-valkey'
  const valkeyPrefix = 'plt:test:caching-valkey'
  const { url } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.maxTTL = 20
    })
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey, valkeyPrefix)
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
    notDeepStrictEqual(mo[1], version)
    deepStrictEqual(mo[2], time)
  }

  const key = keyFor(
    valkeyPrefix,
    'development',
    'values',
    // This might change in different versions of Next.js, keep in sync
    '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
  )
  deepStrictEqual(valkeyCalls, [
    ['info'],
    ['get', key],
    ['set', key, valkeyCalls[2][2], 'EX', '20'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '20'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '20'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '20'],
    ['info'],
    ['get', key],
    ['expire', key, '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '20', 'gt']
  ])
})

test('should not extend the TTL over the original intended one', { skip: isCIOnWindows }, async t => {
  const configuration = 'caching-valkey'
  const valkeyPrefix = 'plt:test:caching-valkey'
  const { url } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.maxTTL = 10
    })

    const pageFile = await readFile(resolve(root, 'services/frontend/src/app/route/route.js'), 'utf-8')
    await writeFile(
      resolve(root, 'services/frontend/src/app/route/route.js'),
      pageFile.replace('revalidate = 120', 'revalidate = 11'),
      'utf-8'
    )
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey, valkeyPrefix)
  const monitor = await valkey.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await monitor.disconnect()
    await valkey.disconnect()
  })

  let delay
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

    delay = data.delay
    notDeepStrictEqual(data.version, version)
    deepStrictEqual(data.time, time)
  }

  const key = keyFor(
    valkeyPrefix,
    'development',
    'values',
    // This might change in different versions of Next.js, keep in sync
    '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
  )

  const baseTTL = 11 - delay
  let ttl

  // Given time scheduling, the TTL might be 1 second less or more than the expected one, check for all of them
  for (const adjust of [-1, 0, 1]) {
    const candidate = (baseTTL + adjust).toString()

    if (valkeyCalls[12][2] === candidate) {
      ttl = candidate
      break
    }
  }

  deepStrictEqual(valkeyCalls, [
    ['info'],
    ['get', key],
    ['set', key, valkeyCalls[2][2], 'EX', '10'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '10'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '10'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '10'],
    ['info'],
    ['get', key],
    ['expire', key, ttl, 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), ttl, 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), ttl, 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), ttl, 'gt']
  ])
})

test('should handle read error', { skip: isCIOnWindows }, async t => {
  const configuration = 'caching-valkey'
  const valkeyPrefix = 'plt:test:caching-valkey'
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.url = cache.url.replace('://', '://plt-caching-test@')
    })
  })

  const valkeyUser = 'plt-caching-test'
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey, valkeyPrefix)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO')

  t.after(async () => {
    await valkey.acl('delUser', valkeyUser)
    await valkey.disconnect()
  })

  const response = await fetch(url + '/route')
  deepStrictEqual((await response.json()).time, 0)

  const logs = await getLogs(runtime)

  ok(
    logs.find(l => {
      return (
        l.msg === 'Cannot read cache value from Valkey' &&
        l.err?.message === "NOPERM User plt-caching-test has no permissions to run the 'get' command"
      )
    })
  )
})

test('should handle deserialization error', { skip: isCIOnWindows }, async t => {
  const configuration = 'caching-valkey'
  const valkeyPrefix = 'plt:test:caching-valkey'
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration)

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))

  const fetchKey = keyFor(
    valkeyPrefix,
    'development',
    'values',
    // This might change in different versions of Next.js, keep in sync
    '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
  )

  await cleanupCache(valkey, valkeyPrefix)
  await valkey.set(fetchKey, 'invalid')

  t.after(async () => {
    await valkey.disconnect()
  })

  const response = await fetch(url + '/route')
  deepStrictEqual((await response.json()).time, 0)

  const logs = await getLogs(runtime)

  ok(
    logs.find(l => {
      return (
        l.msg === 'Cannot deserialize cache value from Valkey' &&
        l.err?.message === 'Unexpected end of buffer reading string'
      )
    })
  )
})

test('should handle refresh error', { skip: isCIOnWindows }, async t => {
  const configuration = 'caching-valkey'
  const valkeyPrefix = 'plt:test:caching-valkey'
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.url = cache.url.replace('://', '://plt-caching-test@')
      cache.maxTTL = 10
    })
  })

  const valkeyUser = 'plt-caching-test'
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey, valkeyPrefix)

  // Set the key
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO', '+GET', '+SET', '+SADD', '+EXPIRE')

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

  const logs = await getLogs(runtime)

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
  const configuration = 'caching-valkey'
  const valkeyPrefix = 'plt:test:caching-valkey'
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.url = cache.url.replace('://', '://plt-caching-test@')
    })
  })

  const valkeyUser = 'plt-caching-test'
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey, valkeyPrefix)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO', '+GET', '-SET')

  t.after(async () => {
    await valkey.acl('delUser', valkeyUser)
    await valkey.disconnect()
  })

  const response = await fetch(url + '/route')
  notDeepStrictEqual((await response.json()).time, 0)

  const logs = await getLogs(runtime)

  ok(
    logs.find(l => {
      return (
        l.msg === 'Cannot write cache value in Valkey' &&
        l.err?.message === "NOPERM User plt-caching-test has no permissions to run the 'set' command"
      )
    })
  )
})

test('should handle refresh error', { skip: isCIOnWindows }, async t => {
  const configuration = 'caching-valkey'
  const valkeyPrefix = 'plt:test:caching-valkey'
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.url = cache.url.replace('://', '://plt-caching-test@')
      cache.maxTTL = 20
    })
  })

  const valkeyUser = 'plt-caching-test'
  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey, valkeyPrefix)

  // Set the key
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO', '+GET', '+SET', '+SADD', '+EXPIRE')

  t.after(async () => {
    await valkey.acl('delUser', valkeyUser)
    await valkey.disconnect()
  })

  {
    const response = await fetch(url + '/route')
    notDeepStrictEqual((await response.json()).time, 0)
  }

  await valkey.acl('deluser', valkeyUser)
  await valkey.acl('setuser', valkeyUser, 'on', 'nopass', 'allkeys', '+INFO')

  await fetch(url + '/revalidate')

  const logs = await getLogs(runtime)

  ok(
    logs.find(l => {
      return (
        l.msg === 'Cannot expire cache tags in Valkey' &&
        l.err?.message === "NOPERM User plt-caching-test has no permissions to run the 'sscan' command"
      )
    })
  )
})
