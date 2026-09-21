import { equal } from 'node:assert'
import { stat } from 'node:fs/promises'
import { platform, tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('shared tmp directories are world-writable while the socket directory is private', async t => {
  /* https://github.com/platformatic/platformatic/issues/2847 */
  if (platform() === 'win32') {
    t.skip('Unix socket permissions test skipped on Windows')
    return
  }

  const projectDir = join(fixturesDir, 'management-api-without-metrics')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const sharedRoot = join(tmpdir(), 'platformatic')
  const runtimesDir = join(sharedRoot, 'runtimes')
  const pidDir = join(runtimesDir, process.pid.toString())

  // Shared directories must be writable by every user, like os.tmpdir() itself
  equal((await stat(sharedRoot)).mode & 0o7777, 0o1777)
  equal((await stat(runtimesDir)).mode & 0o7777, 0o1777)

  // The directory containing the management API socket is only accessible by the current user
  equal((await stat(pidDir)).mode & 0o7777, 0o700)
})
