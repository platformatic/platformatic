import assert from 'node:assert'
import { access, cp } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { createTemporaryDirectory } from '../../../basic/test/helper.js'
import { create } from '../../index.js'

test('compile typescript', async t => {
  const testDir = join(import.meta.dirname, '..', 'fixtures', 'typescript-plugin')
  const cwd = await createTemporaryDirectory(t)
  await cp(testDir, cwd, { recursive: true })

  const service = await create(join(cwd, 'platformatic.service.no-logging.json'))
  await service.build()

  const jsPluginPath = join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
  } catch (err) {
    assert.fail(err)
  }
})
