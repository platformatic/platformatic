import { deepStrictEqual, ok } from 'node:assert'
import path from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, getLogsFromFile } from '../../basic/test/helper.js'

test('should not show start in handle mode in production', async t => {
  const { url, root, runtime } = await createRuntime({
    t,
    root: path.resolve(import.meta.dirname, './fixtures/standalone'),
    build: true,
    production: true
  })

  {
    const { statusCode } = await request(url + '/')
    deepStrictEqual(statusCode, 200)
    await runtime.close()
  }

  const logs = await getLogsFromFile(root)

  ok(
    !logs.find(
      entry =>
        entry.level === 40 &&
        entry.name === 'frontend' &&
        entry.msg.startsWith(
          'A listener has been added for the "process.uncaughtException" event. This listener will be never triggered as Watt default behavior will kill the process before.'
        )
    )
  )
})
