import { strict as assert } from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { request } from 'undici'
import { createRuntime } from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'

const content = 'export const message = "Hello from Vite!"\n'.repeat(64)

// Vite copies public/ to the build output as is, so the build carries the compressed siblings
function setup (preCompressed) {
  return async root => {
    const application = resolve(root, 'services/frontend')
    const pub = resolve(application, 'public')

    await mkdir(pub, { recursive: true })
    await writeFile(resolve(pub, 'asset.js'), content)
    await writeFile(resolve(pub, 'asset.js.br'), brotliCompressSync(content))
    await writeFile(resolve(pub, 'asset.js.gz'), gzipSync(content))

    if (typeof preCompressed !== 'undefined') {
      await updateConfigFile(resolve(application, 'platformatic.application.json'), config => {
        config.vite = { preCompressed }
        return config
      })
    }
  }
}

async function createPreCompressedRuntime (t, preCompressed, env = {}) {
  for (const [key, value] of Object.entries(env)) {
    const original = process.env[key]
    process.env[key] = value
    t.after(() => {
      if (typeof original === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = original
      }
    })
  }

  return createRuntime({
    t,
    root: resolve(import.meta.dirname, './fixtures/not-found-handling'),
    build: true,
    production: true,
    additionalSetup: setup(preCompressed)
  })
}

test('should not serve pre-compressed files by default', async t => {
  const { url } = await createPreCompressedRuntime(t)

  const response = await request(`${url}/asset.js`, { headers: { 'accept-encoding': 'br, gzip' } })

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-encoding'], undefined)
  assert.strictEqual(await response.body.text(), content)
})

test('should serve the brotli file when preCompressed is true and the client accepts br', async t => {
  const { url } = await createPreCompressedRuntime(t, true)

  const response = await request(`${url}/asset.js`, { headers: { 'accept-encoding': 'br, gzip' } })

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-encoding'], 'br')
  assert.match(response.headers['content-type'], /^text\/javascript|^application\/javascript/)
  assert.match(response.headers.vary, /accept-encoding/i)
  assert.deepStrictEqual(Buffer.from(await response.body.arrayBuffer()), brotliCompressSync(content))
})

test('should serve the gzip file when preCompressed is true and the client accepts only gzip', async t => {
  const { url } = await createPreCompressedRuntime(t, true)

  const response = await request(`${url}/asset.js`, { headers: { 'accept-encoding': 'gzip' } })

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-encoding'], 'gzip')
  assert.deepStrictEqual(Buffer.from(await response.body.arrayBuffer()), gzipSync(content))
})

test('should serve the original file when preCompressed is true and the client accepts no encoding', async t => {
  const { url } = await createPreCompressedRuntime(t, true)

  const response = await request(`${url}/asset.js`, { headers: { 'accept-encoding': 'identity' } })

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-encoding'], undefined)
  assert.strictEqual(await response.body.text(), content)
})

async function verifyBrotli (url) {
  const response = await request(`${url}/asset.js`, { headers: { 'accept-encoding': 'br, gzip' } })

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-encoding'], 'br')
  assert.deepStrictEqual(Buffer.from(await response.body.arrayBuffer()), brotliCompressSync(content))
}

async function verifyUncompressed (url) {
  const response = await request(`${url}/asset.js`, { headers: { 'accept-encoding': 'br, gzip' } })

  assert.strictEqual(response.statusCode, 200)
  assert.strictEqual(response.headers['content-encoding'], undefined)
  assert.strictEqual(await response.body.text(), content)
}

test('should serve pre-compressed files when preCompressed is a placeholder resolving to "true"', async t => {
  const { url } = await createPreCompressedRuntime(t, '{PLT_VITE_PRECOMPRESSED}', { PLT_VITE_PRECOMPRESSED: 'true' })

  await verifyBrotli(url)
})

test('should not serve pre-compressed files when preCompressed is a placeholder resolving to "false"', async t => {
  const { url } = await createPreCompressedRuntime(t, '{PLT_VITE_PRECOMPRESSED}', { PLT_VITE_PRECOMPRESSED: 'false' })

  await verifyUncompressed(url)
})

test('should serve pre-compressed files when preCompressed is an object with enabled=true', async t => {
  const { url } = await createPreCompressedRuntime(t, { enabled: true })

  await verifyBrotli(url)
})

test('should not serve pre-compressed files when preCompressed is an object with enabled=false', async t => {
  const { url } = await createPreCompressedRuntime(t, { enabled: false })

  await verifyUncompressed(url)
})

test('should not serve pre-compressed files when preCompressed is false', async t => {
  const { url } = await createPreCompressedRuntime(t, false)

  await verifyUncompressed(url)
})

test('should serve pre-compressed files when preCompressed.enabled enables the production environment', async t => {
  const { url } = await createPreCompressedRuntime(t, { enabled: { production: true } })

  await verifyBrotli(url)
})

test('should not serve pre-compressed files when preCompressed.enabled disables the production environment', async t => {
  const { url } = await createPreCompressedRuntime(t, { enabled: { production: false, development: true } })

  await verifyUncompressed(url)
})

test('should serve pre-compressed files when preCompressed.enabled is a placeholder resolving to "true"', async t => {
  const { url } = await createPreCompressedRuntime(t, { enabled: '{PLT_VITE_PRECOMPRESSED}' }, { PLT_VITE_PRECOMPRESSED: 'true' })

  await verifyBrotli(url)
})
