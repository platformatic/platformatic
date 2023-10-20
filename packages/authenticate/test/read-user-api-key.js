import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { getUserApiKey } from '../lib/login.js'

test('should read user api key', async (t) => {
  const platformaticDir = await mkdtemp(join(tmpdir(), 'plt-authenticate-'))
  const configPath = join(platformaticDir, 'config.json')

  const config = {
    userApiKey: '12345678901234567890123456789012'
  }
  await writeFile(configPath, JSON.stringify(config))

  const userApiKey = await getUserApiKey(configPath)
  assert.equal(userApiKey, config.userApiKey)
})
