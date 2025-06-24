import { ConfigManager } from '@platformatic/config'
import { safeRemove } from '@platformatic/utils'
import Redis from 'iovalkey'
import { unpack } from 'msgpackr'
import { deepStrictEqual, notDeepStrictEqual, ok } from 'node:assert'
import { cp, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { pino } from 'pino'
import { parse } from 'semver'
import {
  commonFixturesRoot,
  fixturesDir,
  getLogs,
  isCIOnWindows,
  prepareRuntime,
  setFixturesDir,
  sleep,
  startRuntime,
  temporaryFolder
} from '../../../basic/test/helper.js'
import CacheHandler, { keyFor } from '../../lib/caching/valkey.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, '../fixtures'))

const valkeyPrefix = 'plt:test:caching-valkey'
const configuration = 'caching-valkey'
const valkeyUser = 'plt-caching-test'

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

async function cleanupCache (valkey, valkeyUser) {
  const keys = await valkey.keys(keyFor('plt:test:caching-valkey', '*'))

  if (keys.length === 0) {
    return
  }

  await valkey.acl('delUser', valkeyUser)
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

function verifyValkeySequence (actual, expected) {
  actual = actual.filter(c => c[0] !== 'info')

  // Get stored values
  const storedValues = actual.filter(c => c[0] === 'set').map(c => c[2])
  let current = 0

  // Replace in the expected set
  for (const command of expected) {
    if (command[0] === 'set') {
      command[2] = storedValues[current++]
    }
  }
  deepStrictEqual(actual, expected)

  return storedValues
}

test(
  'should properly use the Valkey cache handler in development to cache fetch calls but not pages',
  { skip: isCIOnWindows },
  async t => {
    const { url } = await prepareRuntimeWithBackend(t, configuration)
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

    const storedValues = verifyValkeySequence(valkeyCalls, [
      ['get', key],
      ['set', key, null, 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '120'],
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
      maxTTL,
      serviceId
    } = unpack(Buffer.from(storedValues[0], 'base64url'))

    deepStrictEqual(kind, 'FETCH')
    deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
    deepStrictEqual(status, 200)
    deepStrictEqual(cachedUrl, 'http://backend.plt.local/time')
    deepStrictEqual(tags, ['first', 'second', 'third'])
    deepStrictEqual(revalidateNext, 120)
    deepStrictEqual(revalidatePlt, 120)
    deepStrictEqual(maxTTL, 86400 * 7)
    deepStrictEqual(serviceId, 'frontend')
  }
)

test(
  'should properly use the Valkey cache handler in production to cache fetch calls and pages',
  { skip: isCIOnWindows },
  async t => {
    const { url, root } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

    const nextPackageJson = JSON.parse(
      await readFile(resolve(root, 'services/frontend/node_modules/next/package.json'), 'utf-8')
    )
    const nextMajor = parse(nextPackageJson.version).major

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

    const pageKey = keyFor(valkeyPrefix, prefix, 'values', '/index')

    const fetchKey = keyFor(
      valkeyPrefix,
      prefix,
      'values',
      // This might change in different versions of Next.js, keep in sync
      '148b162ff22d9254deb767bd4e98ff4b55486dcdb575630bd42a59c86a2cb01d'
    )

    let storedValues

    switch (nextMajor) {
      case 14:
        storedValues = verifyValkeySequence(valkeyCalls, [
          ['get', pageKey],
          ['get', fetchKey],
          ['set', fetchKey, null, 'EX', '120'],
          ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'first'), fetchKey],
          ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'first'), '120'],
          ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'second'), fetchKey],
          ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'second'), '120'],
          ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'third'), fetchKey],
          ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'third'), '120'],
          ['get', fetchKey],
          ['set', pageKey, null, 'EX', '120'],
          ['get', pageKey]
        ])
        break
      case 15:
        storedValues = verifyValkeySequence(valkeyCalls, [
          ['get', pageKey],
          ['get', fetchKey],
          ['set', fetchKey, null, 'EX', '120'],
          ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'first'), fetchKey],
          ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'first'), '120'],
          ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'second'), fetchKey],
          ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'second'), '120'],
          ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'third'), fetchKey],
          ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'third'), '120'],
          ['set', pageKey, null, 'EX', '120'],
          ['get', pageKey]
        ])
        break
    }

    {
      const {
        value: {
          kind,
          data: { body, status, url: cachedUrl },
          revalidate: revalidateNext
        },
        tags,
        revalidate: revalidatePlt,
        maxTTL,
        serviceId
      } = unpack(Buffer.from(storedValues[0], 'base64url'))

      deepStrictEqual(kind, 'FETCH')
      deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
      deepStrictEqual(status, 200)
      deepStrictEqual(cachedUrl, 'http://backend.plt.local/time')
      deepStrictEqual(tags, ['first', 'second', 'third'])
      deepStrictEqual(revalidateNext, 120)
      deepStrictEqual(revalidatePlt, 120)
      deepStrictEqual(maxTTL, 86400 * 7)
      deepStrictEqual(serviceId, 'frontend')
    }

    {
      const {
        value: { kind, html, headers, status },
        revalidate,
        maxTTL,
        serviceId
      } = unpack(Buffer.from(storedValues[1], 'base64url'))

      switch (nextMajor) {
        case 14:
          deepStrictEqual(kind, 'PAGE')
          deepStrictEqual(headers['x-next-cache-tags'], 'first,second,third,_N_T_/layout,_N_T_/page,_N_T_/')
          break
        case 15:
          deepStrictEqual(kind, 'APP_PAGE')
          deepStrictEqual(headers['x-next-cache-tags'], '_N_T_/layout,_N_T_/page,_N_T_/,first,second,third')
          break
      }

      ok(html.includes(`<div>Hello from v<!-- -->${version}<!-- --> t<!-- -->${time}</div>`))

      deepStrictEqual(status, 200)
      deepStrictEqual(revalidate, 120)
      deepStrictEqual(maxTTL, 86400 * 7)
      deepStrictEqual(serviceId, 'frontend')
    }
  }
)

test(
  'should properly use the Valkey cache handler in development to cache fetch calls but not route handler',
  { skip: isCIOnWindows },
  async t => {
    const { url } = await prepareRuntimeWithBackend(t, configuration, false)

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

      notDeepStrictEqual(data.version, version)
      deepStrictEqual(data.time, time)
    }

    const key = keyFor(
      valkeyPrefix,
      'development',
      'values',
      // This might change in different versions of Next.js, keep in sync
      'd6b87585b19fac215038c88425d68b057920faf4585fa91a7058ae1ce5d70d8f'
    )
    const storedValues = verifyValkeySequence(valkeyCalls, [
      ['get', key],
      ['set', key, null, 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
      ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '120'],
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
      maxTTL,
      serviceId
    } = unpack(Buffer.from(storedValues[0], 'base64url'))

    deepStrictEqual(kind, 'FETCH')
    deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
    deepStrictEqual(status, 200)
    deepStrictEqual(cachedUrl, 'http://backend.plt.local/time-alternative')
    deepStrictEqual(tags, ['first', 'second', 'third'])
    deepStrictEqual(revalidateNext, 120)
    deepStrictEqual(revalidatePlt, 120)
    deepStrictEqual(maxTTL, 86400 * 7)
    deepStrictEqual(serviceId, 'frontend')
  }
)

test(
  'should properly use the Valkey cache handler in production to cache fetch calls and route handler',
  { skip: isCIOnWindows },
  async t => {
    const { url, root } = await prepareRuntimeWithBackend(t, configuration, true, false, ['frontend'])

    const nextPackageJson = JSON.parse(
      await readFile(resolve(root, 'services/frontend/node_modules/next/package.json'), 'utf-8')
    )
    const nextMajor = parse(nextPackageJson.version).major

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

    const routeKey = keyFor(valkeyPrefix, prefix, 'values', '/route')

    const fetchKey = keyFor(
      valkeyPrefix,
      prefix,
      'values',
      // This might change in different versions of Next.js, keep in sync
      'd6b87585b19fac215038c88425d68b057920faf4585fa91a7058ae1ce5d70d8f'
    )

    const storedValues = verifyValkeySequence(valkeyCalls, [
      ['get', routeKey],
      ['get', fetchKey],
      ['set', fetchKey, null, 'EX', '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'first'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'first'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'second'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'second'), '120'],
      ['sadd', keyFor(valkeyPrefix, prefix, 'tags', 'third'), fetchKey],
      ['expire', keyFor(valkeyPrefix, prefix, 'tags', 'third'), '120'],
      ['set', routeKey, null, 'EX', '120'],
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
        maxTTL,
        serviceId
      } = unpack(Buffer.from(storedValues[0], 'base64url'))

      deepStrictEqual(kind, 'FETCH')
      deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
      deepStrictEqual(status, 200)
      deepStrictEqual(cachedUrl, 'http://backend.plt.local/time-alternative')
      deepStrictEqual(tags, ['first', 'second', 'third'])
      deepStrictEqual(revalidateNext, 120)
      deepStrictEqual(revalidatePlt, 120)
      deepStrictEqual(maxTTL, 86400 * 7)
      deepStrictEqual(serviceId, 'frontend')
    }

    {
      const {
        value: { kind, body, headers, status },
        revalidate,
        maxTTL,
        serviceId
      } = unpack(Buffer.from(storedValues[1], 'base64url'))

      switch (nextMajor) {
        case 14:
          deepStrictEqual(kind, 'ROUTE')
          deepStrictEqual(headers['x-next-cache-tags'], 'first,second,third,_N_T_/layout,_N_T_/route,_N_T_/route/route')
          break
        case 15:
          deepStrictEqual(kind, 'APP_ROUTE')
          deepStrictEqual(
            headers['x-next-cache-tags'],
            '_N_T_/layout,_N_T_/route,_N_T_/route/route,_N_T_/route,first,second,third'
          )
          break
      }

      deepStrictEqual({ ...JSON.parse(body), delay: 0 }, { delay: 0, version, time })
      deepStrictEqual(status, 200)
      deepStrictEqual(revalidate, 120)
      deepStrictEqual(maxTTL, 86400 * 7)
      deepStrictEqual(serviceId, 'frontend')
    }
  }
)

test('should properly revalidate tags in Valkey', { skip: isCIOnWindows }, async t => {
  const { url } = await prepareRuntimeWithBackend(t, configuration)

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

  verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, null, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '120'],
    ['sscan', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '0'],
    ['del', key],
    ['del', keyFor(valkeyPrefix, 'development', 'tags', 'first')],
    ['sscan', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '0'],
    ['del', key],
    ['del', keyFor(valkeyPrefix, 'development', 'tags', 'second')],
    ['sscan', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '0'],
    ['del', key],
    ['del', keyFor(valkeyPrefix, 'development', 'tags', 'third')],
    ['get', key],
    ['set', key, null, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '120'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '120']
  ])
})

test('should extend TTL when our limit is smaller than the user one', { skip: isCIOnWindows }, async t => {
  const { url } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
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
  verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, null, 'EX', '20'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '20'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '20'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '20'],
    ['get', key],
    ['expire', key, '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '20', 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '20', 'gt']
  ])
})

test('should not extend the TTL over the original intended one', { skip: isCIOnWindows }, async t => {
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
    'd6b87585b19fac215038c88425d68b057920faf4585fa91a7058ae1ce5d70d8f'
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

  verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, null, 'EX', '10'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), '10'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'second'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), '10'],
    ['sadd', keyFor(valkeyPrefix, 'development', 'tags', 'third'), key],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), '10'],
    ['get', key],
    ['expire', key, ttl, 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'first'), ttl, 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'second'), ttl, 'gt'],
    ['expire', keyFor(valkeyPrefix, 'development', 'tags', 'third'), ttl, 'gt']
  ])
})

test('should handle read error', { skip: isCIOnWindows }, async t => {
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.url = cache.url.replace('://', '://plt-caching-test@')
    })
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
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
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration)

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))

  const fetchKey = keyFor(
    valkeyPrefix,
    'development',
    'values',
    // This might change in different versions of Next.js, keep in sync
    'd6b87585b19fac215038c88425d68b057920faf4585fa91a7058ae1ce5d70d8f'
  )

  await cleanupCache(valkey)
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
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.url = cache.url.replace('://', '://plt-caching-test@')
      cache.maxTTL = 10
    })
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)

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
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.url = cache.url.replace('://', '://plt-caching-test@')
    })
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)
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
  const { url, runtime } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await setCacheSettings(root, cache => {
      cache.url = cache.url.replace('://', '://plt-caching-test@')
      cache.maxTTL = 20
    })
  })

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  await cleanupCache(valkey)

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

test('can be used without the runtime - per-method flag', { skip: isCIOnWindows }, async t => {
  const logsPath = resolve(temporaryFolder, `logs-valkey-next-${Date.now()}.log`)

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  const monitorCollection = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))

  await cleanupCache(valkey)
  const monitor = await monitorCollection.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await cleanupCache(valkey)
    await monitor.disconnect()
    await valkey.disconnect()
    await monitorCollection.disconnect()
    await safeRemove(logsPath)
  })

  const handler = new CacheHandler({
    store: valkey,
    prefix: valkeyPrefix,
    logger: pino({
      level: 'trace',
      transport: {
        target: 'pino/file',
        options: { destination: logsPath }
      }
    })
  })

  const key = `${valkeyPrefix}:key`
  await handler.set(key, 'value', { revalidate: 120, tags: ['first'] }, true)
  const cached = await handler.get(key, null, true)
  await handler.remove(key, true)

  // Wait for logs to be written
  await sleep(3000)

  const logs = (await readFile(logsPath, 'utf-8'))
    .trim()
    .split('\n')
    .map(l => {
      const parsed = JSON.parse(l)

      return { msg: parsed.msg, key: parsed.key, value: parsed.value }
    })

  verifyValkeySequence(valkeyCalls, [
    ['set', key, null, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'tags', 'first'), '120'],
    ['get', key],
    ['get', key],
    ['del', key],
    ['srem', keyFor(valkeyPrefix, '', 'tags', 'first'), key]
  ])

  deepStrictEqual(
    { ...cached, lastModified: 0 },
    {
      value: 'value',
      lastModified: 0,
      revalidate: 120,
      tags: ['first'],
      maxTTL: 86400
    }
  )

  deepStrictEqual(logs, [
    { msg: 'cache set', key, value: 'value' },
    { msg: 'cache get', key, value: undefined },
    { msg: 'cache remove', key, value: undefined }
  ])
})

test('can be used without the runtime - standalone mode', { skip: isCIOnWindows }, async t => {
  const logsPath = resolve(temporaryFolder, `logs-valkey-next-${Date.now()}.log`)

  const valkey = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))
  const monitorCollection = new Redis(await getValkeyUrl(resolve(fixturesDir, configuration)))

  await cleanupCache(valkey)
  const monitor = await monitorCollection.monitor()
  const valkeyCalls = []

  monitor.on('monitor', (_, args) => {
    valkeyCalls.push(args)
  })

  t.after(async () => {
    await cleanupCache(valkey)
    await monitor.disconnect()
    await valkey.disconnect()
    await monitorCollection.disconnect()
    await safeRemove(logsPath)
  })

  const handler = new CacheHandler({
    standalone: true,
    store: valkey,
    prefix: valkeyPrefix,
    logger: pino({
      level: 'trace',
      transport: {
        target: 'pino/file',
        options: { destination: logsPath }
      }
    })
  })

  const key = `${valkeyPrefix}:key`
  await handler.set(key, 'value', { revalidate: 120, tags: ['first'] })
  const cached = await handler.get(key)
  await handler.remove(key)

  // Wait for logs to be written
  await sleep(3000)

  const logs = (await readFile(logsPath, 'utf-8'))
    .trim()
    .split('\n')
    .map(l => {
      const parsed = JSON.parse(l)

      return { msg: parsed.msg, key: parsed.key, value: parsed.value }
    })

  verifyValkeySequence(valkeyCalls, [
    ['set', key, null, 'EX', '120'],
    ['sadd', keyFor(valkeyPrefix, '', 'tags', 'first'), key],
    ['expire', keyFor(valkeyPrefix, '', 'tags', 'first'), '120'],
    ['get', key],
    ['get', key],
    ['del', key],
    ['srem', keyFor(valkeyPrefix, '', 'tags', 'first'), key]
  ])

  deepStrictEqual(
    { ...cached, lastModified: 0 },
    {
      value: 'value',
      lastModified: 0,
      revalidate: 120,
      tags: ['first'],
      maxTTL: 86400
    }
  )

  deepStrictEqual(logs, [
    { msg: 'cache set', key, value: 'value' },
    { msg: 'cache get', key, value: undefined },
    { msg: 'cache remove', key, value: undefined }
  ])
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

  const cacheHit = metrics.find(m => m.name === 'next_cache_valkey_hit_count')
  const cacheMiss = metrics.find(m => m.name === 'next_cache_valkey_miss_count')

  deepStrictEqual(cacheHit.values[0].value, 1) // One for the page (second request)
  deepStrictEqual(cacheMiss.values[0].value, 2) // One for the page (first request), one for the internal fetch
})
