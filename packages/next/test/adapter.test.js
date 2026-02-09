import Redis from 'iovalkey'
import { unpack } from 'msgpackr'
import { deepStrictEqual, notDeepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { fixturesDir, getLogsFromFile, setFixturesDir, updateFile } from '../../basic/test/helper.js'
import { keyFor } from '../lib/caching/valkey-common.js'
import {
  base64ValueMatcher,
  cleanupCache,
  getValkeyUrl,
  prepareRuntimeWithBackend,
  valkeyPrefix,
  verifyValkeySequence
} from './caching/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))
const configuration = 'caching-adapter'

test('should properly instrument the application when using the adapter', async t => {
  const { root, url } = await prepareRuntimeWithBackend(t, configuration)

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

  const key = new RegExp('^' + keyFor(valkeyPrefix, 'development', 'values'))

  const storedValues = verifyValkeySequence(valkeyCalls, [
    ['get', key],
    ['set', key, base64ValueMatcher, 'EX', '120'],
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
    applicationId
  } = unpack(Buffer.from(storedValues[0], 'base64url'))

  deepStrictEqual(kind, 'FETCH')
  deepStrictEqual(body, Buffer.from(JSON.stringify({ time: parseInt(time) })).toString('base64'))
  deepStrictEqual(status, 200)
  deepStrictEqual(cachedUrl, 'http://backend.plt.local/time')
  deepStrictEqual(tags, ['first', 'second', 'third'])
  deepStrictEqual(revalidateNext, 120)
  deepStrictEqual(revalidatePlt, 120)
  deepStrictEqual(maxTTL, 86400 * 7)
  deepStrictEqual(applicationId, 'frontend')

  const logs = await getLogsFromFile(root)

  ok(
    !logs.find(
      l =>
        l.level === 40 &&
        l.msg === 'The experimental Next.js adapterPath is enabled but the @platformatic/next adapter was not included.'
    )
  )
})

test('should show a warning and not instrument the file when the next.config.js does not contain the adapter', async t => {
  const { root, url } = await prepareRuntimeWithBackend(t, configuration, false, false, false, async root => {
    await updateFile(resolve(root, 'services/frontend/next.config.mjs'), raw => {
      return raw.replace(/adapterPath.+/, '')
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

  deepStrictEqual(valkeyCalls.length, 0)

  const logs = await getLogsFromFile(root)

  ok(
    logs.find(
      l =>
        l.level === 40 &&
        l.msg === 'The experimental Next.js adapterPath is enabled but the @platformatic/next adapter was not included.'
    )
  )
})
