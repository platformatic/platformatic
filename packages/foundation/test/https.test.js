import { deepStrictEqual, strictEqual } from 'node:assert'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { sanitizeHTTPSArgument, sanitizeHTTPSOptions } from '../index.js'

test('sanitizeHTTPSArgument returns strings as-is', async () => {
  strictEqual(await sanitizeHTTPSArgument('secret'), 'secret')
})

test('sanitizeHTTPSArgument reads path objects', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-foundation-https-test-'))
  const file = join(tmpDir, 'secret.pem')
  await writeFile(file, 'secret')

  deepStrictEqual(await sanitizeHTTPSArgument({ path: file }), Buffer.from('secret'))
})

test('sanitizeHTTPSOptions reads key and cert path objects', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'plt-foundation-https-test-'))
  const key = join(tmpDir, 'https.key')
  const cert = join(tmpDir, 'https.crt')
  await writeFile(key, 'key')
  await writeFile(cert, 'cert')

  deepStrictEqual(await sanitizeHTTPSOptions({ allowHTTP1: true, key: [{ path: key }], cert: { path: cert } }), {
    allowHTTP1: true,
    key: [Buffer.from('key')],
    cert: Buffer.from('cert')
  })
})
