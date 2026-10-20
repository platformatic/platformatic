import { updateGlobals } from '@platformatic/globals'
import Redis from 'iovalkey'
import { deepStrictEqual, ok } from 'node:assert'
import { EventEmitter } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReadableStream } from 'node:stream/web'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

// Next.js serves an entry past its revalidate time as stale while it regenerates it,
// so the entries must stay in Valkey after it.

const valkeyUrl = `valkey://${process.env.VALKEY_HOST ?? 'localhost'}:${process.env.VALKEY_PORT ?? 6379}`
const prefix = 'plt:test:entries-lifetime'
const maxTTL = 3600

async function setup (t, cacheMaxTTL = maxTTL) {
  const root = await mkdtemp(join(tmpdir(), 'plt-next-entries-lifetime-'))
  await mkdir(join(root, '.next'), { recursive: true })
  await writeFile(join(root, '.next/BUILD_ID'), 'build-id')

  const events = new EventEmitter()

  updateGlobals({
    root: pathToFileURL(root).toString(),
    isBuilding: false,
    events,
    applicationId: 'frontend',
    workerId: 0,
    config: { cache: { adapter: 'valkey', url: valkeyUrl, prefix, maxTTL: cacheMaxTTL } }
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

  return valkey
}

async function listKeys (valkey, section) {
  const keys = []
  for await (const batch of valkey.scanStream({ match: `${prefix}:cache:next:build-id:${section}:*` })) {
    keys.push(...batch)
  }
  return keys
}

async function deleteKeys (valkey) {
  const keys = []
  for await (const batch of valkey.scanStream({ match: `${prefix}:*` })) {
    keys.push(...batch)
  }

  if (keys.length) {
    await valkey.del(...keys)
  }
}

// The TTL of the only stored entry and of its tag set
async function getTTLs (valkey, valuesSection, tagsSection) {
  const [key] = await listKeys(valkey, valuesSection)
  const [tagsKey] = await listKeys(valkey, tagsSection)

  return { key, entry: await valkey.ttl(key), tags: await valkey.ttl(tagsKey) }
}

function page () {
  return { kind: 'APP_PAGE', html: '<html></html>', rscData: Buffer.from(''), headers: {}, status: 200 }
}

function componentsEntry (revalidate, expire) {
  return {
    value: new ReadableStream({
      start (controller) {
        controller.enqueue(Buffer.from('payload'))
        controller.close()
      }
    }),
    tags: ['products'],
    stale: 300,
    timestamp: Date.now(),
    revalidate,
    expire
  }
}

async function isrHandler () {
  const { CacheHandler } = await import('../../lib/caching/valkey-isr.js')
  return new CacheHandler()
}

async function componentsHandler () {
  const { CacheHandler } = await import('../../lib/caching/valkey-components.js')
  return new CacheHandler()
}

test('ISR handler - keeps pages until their expire time', async t => {
  const valkey = await setup(t)
  const handler = await isrHandler()

  await handler.set('/products', page(), { cacheControl: { revalidate: 60, expire: 600 }, tags: ['products'] })

  const { entry, tags } = await getTTLs(valkey, 'values', 'tags')
  deepStrictEqual([entry, tags], [600, 600])
})

test('ISR handler - keeps pages without an expire time twice their revalidate time', async t => {
  const valkey = await setup(t)
  const handler = await isrHandler()

  // Next.js versions before the cacheControl context only pass revalidate
  await handler.set('/products', page(), { revalidate: 60, tags: ['products'] })

  const { entry, tags } = await getTTLs(valkey, 'values', 'tags')
  deepStrictEqual([entry, tags], [120, 120])
})

test('ISR handler - keeps fetches twice their revalidate time', async t => {
  const valkey = await setup(t)
  const handler = await isrHandler()

  const fetchEntry = { kind: 'FETCH', data: { headers: {}, body: '', status: 200, url: 'http://example.com' }, revalidate: 60 }
  await handler.set('fetch-key', fetchEntry, { fetchCache: true, tags: ['products'] })

  const { entry, tags } = await getTTLs(valkey, 'values', 'tags')
  deepStrictEqual([entry, tags], [120, 120])
})

test('ISR handler - limits the entries lifetime to maxTTL', async t => {
  const valkey = await setup(t, 300)
  const handler = await isrHandler()

  await handler.set('/products', page(), { cacheControl: { revalidate: 60, expire: 600 }, tags: ['products'] })

  const { entry, tags } = await getTTLs(valkey, 'values', 'tags')
  deepStrictEqual([entry, tags], [300, 300])
})

test('ISR handler - extends up to maxTTL the entries living longer than it', async t => {
  const valkey = await setup(t, 300)
  const handler = await isrHandler()

  await handler.set('/products', page(), { cacheControl: { revalidate: 60, expire: 600 }, tags: ['products'] })

  const { key } = await getTTLs(valkey, 'values', 'tags')
  await valkey.expire(key, 10)

  ok(await handler.get('/products'))
  deepStrictEqual(await valkey.ttl(key), 300)
})

test('components handler - keeps entries until their expire time', async t => {
  const valkey = await setup(t)
  const handler = await componentsHandler()

  await handler.set('key', Promise.resolve(componentsEntry(60, 600)))

  const { entry, tags } = await getTTLs(valkey, 'components:values', 'components:tags')
  deepStrictEqual([entry, tags], [600, 600])
})

test('components handler - limits the entries lifetime to maxTTL', async t => {
  const valkey = await setup(t, 300)
  const handler = await componentsHandler()

  // The default cache life never expires
  await handler.set('key', Promise.resolve(componentsEntry(60, 4294967294)))

  const { entry, tags } = await getTTLs(valkey, 'components:values', 'components:tags')
  deepStrictEqual([entry, tags], [300, 300])
})

test('components handler - extends up to maxTTL the entries living longer than it', async t => {
  const valkey = await setup(t, 300)
  const handler = await componentsHandler()

  await handler.set('key', Promise.resolve(componentsEntry(60, 600)))

  const { key } = await getTTLs(valkey, 'components:values', 'components:tags')
  await valkey.expire(key, 10)

  ok(await handler.get('key', []))
  deepStrictEqual(await valkey.ttl(key), 300)
})
