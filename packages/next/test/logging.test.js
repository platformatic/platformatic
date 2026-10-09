import { deepStrictEqual, ok, rejects } from 'node:assert'
import { cp, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import {
  commonFixturesRoot,
  ensureDependencies,
  getLogsFromFile,
  prepareRuntime,
  setFixturesDir,
  startRuntime,
  updateFile
} from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('can properly show the logs the output', async t => {
  const { root, runtime } = await prepareRuntime(t, 'composer-with-prefix', true, null, async root => {
    await updateFile(resolve(root, 'platformatic.runtime.json'), contents => {
      const json = JSON.parse(contents)
      json.workers = 3
      return JSON.stringify(json, null, 2)
    })

    await cp(resolve(commonFixturesRoot, 'composer-js'), resolve(root, 'services/composer'), { recursive: true })
    await cp(resolve(commonFixturesRoot, 'backend-js'), resolve(root, 'services/backend'), { recursive: true })
    await ensureDependencies([resolve(root, 'services/composer'), resolve(root, 'services/backend')])

    await updateFile(resolve(root, 'services/composer/routes/root.js'), contents => {
      return contents.replace('$PREFIX', '/frontend')
    })
  })

  const url = await startRuntime(t, runtime, null, ['frontend'])

  {
    const { statusCode } = await request(url + '/frontend')
    deepStrictEqual(statusCode, 200)
  }

  {
    await runtime.close()
    const logs = await getLogsFromFile(root)

    // Each log has either the worker number, comes from the main thread or
    // it is the composer, which is the entrypoint and thus no worker
    ok(logs.every(l => !l.base && (typeof l.worker === 'number' || !l.name || l.name === 'composer')))
  }
})

test('shows the output of the development server when it fails during startup', async t => {
  const { root, runtime } = await prepareRuntime(t, 'standalone', false, null, async (root, config) => {
    config.restartOnError = 0

    // Only fail in the development server child process, not in the worker thread
    await writeFile(
      resolve(root, 'services/frontend/next.config.ts'),
      `if (process.env.NEXT_PRIVATE_WORKER) {
  process.stderr.write('Cannot start the development server\\n')
  process.exit(1)
}

export default {}
`
    )
  })

  await rejects(() => startRuntime(t, runtime), { code: 'PLT_RUNTIME_APPLICATION_WORKER_EXIT' })
  await runtime.close()

  const logs = await getLogsFromFile(root)
  ok(logs.some(l => l.caller === 'STDERR' && l.msg === 'Cannot start the development server'))
})
