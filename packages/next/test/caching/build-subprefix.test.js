import { updateGlobals } from '@platformatic/globals'
import Redis from 'iovalkey'
import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReadableStream } from 'node:stream/web'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { getPlatformaticSubprefix } from '../../lib/caching/valkey-common.js'

const valkeyUrl = `valkey://${process.env.VALKEY_HOST ?? 'localhost'}:${process.env.VALKEY_PORT ?? 6379}`
const prefix = 'plt:test:build-subprefix'

async function setup (t, isBuilding) {
  const root = await mkdtemp(join(tmpdir(), 'plt-next-build-subprefix-'))
  const events = new EventEmitter()

  updateGlobals({
    root: pathToFileURL(root).toString(),
    isBuilding,
    events,
    applicationId: 'frontend',
    workerId: 0,
    config: { cache: { adapter: 'valkey', url: valkeyUrl, prefix, maxTTL: 60 } }
  })

  const valkey = new Redis(valkeyUrl)
  await deleteKeys(valkey)

  t.after(async () => {
    events.emit('plt:next:close')
    await deleteKeys(valkey)
    await valkey.quit()
    await rm(root, { recursive: true, force: true })
    updateGlobals({
      root: undefined,
      isBuilding: undefined,
      events: undefined,
      config: undefined,
      valkeyClients: new Map()
    })
  })

  return { root, valkey }
}

async function writeBuildId (root, buildId) {
  await mkdir(join(root, '.next'), { recursive: true })
  await writeFile(join(root, '.next/BUILD_ID'), buildId)
}

async function listKeys (valkey) {
  const keys = []
  for await (const batch of valkey.scanStream({ match: `${prefix}:*` })) {
    keys.push(...batch)
  }
  return keys
}

async function deleteKeys (valkey) {
  const keys = await listKeys(valkey)
  if (keys.length) {
    await valkey.del(...keys)
  }
}

function componentsEntry () {
  return {
    value: new ReadableStream({
      start (controller) {
        controller.enqueue(Buffer.from('payload'))
        controller.close()
      }
    }),
    tags: [],
    stale: 300,
    timestamp: Date.now(),
    expire: 60,
    revalidate: 60
  }
}

test('getPlatformaticSubprefix - returns the build ID when it exists', async t => {
  const { root } = await setup(t, true)
  await writeBuildId(root, 'build-id')

  strictEqual(getPlatformaticSubprefix(), 'build-id')
})

test('getPlatformaticSubprefix - returns development when not building', async t => {
  await setup(t, false)

  strictEqual(getPlatformaticSubprefix(), 'development')
})

test('getPlatformaticSubprefix - returns null while building without a build ID', async t => {
  await setup(t, true)

  strictEqual(getPlatformaticSubprefix(), null)
})

test('components handler - skips Valkey during a build until the build ID exists', async t => {
  const { root, valkey } = await setup(t, true)
  const { CacheHandler } = await import('../../lib/caching/valkey-components.js')
  const handler = new CacheHandler()

  await handler.set('key', Promise.resolve(componentsEntry()))
  deepStrictEqual(await listKeys(valkey), [])
  strictEqual(await handler.get('key', []), undefined)
  strictEqual(await handler.getExpiration(['_N_T_/']), 0)

  await writeBuildId(root, 'build-id')

  await handler.set('key', Promise.resolve(componentsEntry()))
  const keys = await listKeys(valkey)
  strictEqual(keys.length, 1)
  ok(keys[0].startsWith(`${prefix}:cache:next:build-id:components:values:`))
  ok(await handler.get('key', []))
})

test('ISR handler - skips Valkey during a build until the build ID exists', async t => {
  const { root, valkey } = await setup(t, true)
  const { CacheHandler } = await import('../../lib/caching/valkey-isr.js')
  const handler = new CacheHandler()
  const value = { kind: 'FETCH', data: { headers: {}, body: '', status: 200, url: 'http://example.com' } }

  await handler.set('key', value, { revalidate: 60 })
  deepStrictEqual(await listKeys(valkey), [])
  strictEqual(await handler.get('key'), undefined)

  await writeBuildId(root, 'build-id')

  await handler.set('key', value, { revalidate: 60 })
  const keys = await listKeys(valkey)
  strictEqual(keys.length, 1)
  ok(keys[0].startsWith(`${prefix}:cache:next:build-id:values:`))
  ok(await handler.get('key'))
})
