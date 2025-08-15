import { deepStrictEqual, ok } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { getLogs, prepareRuntime, setFixturesDir, startRuntime, updateFile } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

// Disable profiling to avoid conflicts in tests
process.env.PLT_DISABLE_FLAMEGRAPHS = '1'

test('can properly show the headers in the output', async t => {
  const { root, config } = await prepareRuntime(t, 'server-side-standalone', false, null, async root => {
    await updateFile(resolve(root, 'services/frontend/src/app/page.js'), contents => {
      return (
        "import { headers } from 'next/headers'\n\n" +
        contents.replace("'use server'", "'use server'\nconsole.log(await headers())")
      )
    })
  })

  const { runtime, url } = await startRuntime(t, root, config)

  {
    const { statusCode } = await request(url, { headers: { 'x-test': 'test' } })
    deepStrictEqual(statusCode, 200)
  }

  {
    const logs = await getLogs(runtime)
    ok(logs.some(l => l.msg.includes('x-test')))
  }
})

test('can access Platformatic globals in production mode', async t => {
  const { root, config } = await prepareRuntime(t, 'basepath-production', true, null)
  const { url } = await startRuntime(t, root, config, null, ['frontend'])

  {
    const { statusCode, body } = await request(url + '/frontend')
    deepStrictEqual(statusCode, 200)

    const text = await body.text()
    ok(text.includes('<code>/frontend<!-- --> <!-- -->true</code>'))
  }
})
