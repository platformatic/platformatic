import { deepStrictEqual, ok } from 'node:assert'
import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import {
  commonFixturesRoot,
  getLogsFromFile,
  prepareRuntime,
  setFixturesDir,
  startRuntime,
  updateFile
} from '../../basic/test/helper.js'
import { prepareRuntimeWithBackend } from './caching/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('can properly show the headers in the output', async t => {
  const { root, runtime } = await prepareRuntime(t, 'server-side-standalone', false, null, async root => {
    await updateFile(resolve(root, 'platformatic.runtime.json'), contents => {
      const parsed = JSON.parse(contents)
      parsed.logger.level = 'info'
      return JSON.stringify(parsed, null, 2)
    })

    await updateFile(resolve(root, 'services/frontend/src/app/page.js'), contents => {
      return (
        "import { headers } from 'next/headers'\n\n" +
        contents.replace("'use server'", "'use server'\nconsole.log(await headers())")
      )
    })
  })

  const url = await startRuntime(t, runtime)

  {
    const { statusCode } = await request(url, { headers: { 'x-test': 'test' } })
    deepStrictEqual(statusCode, 200)
  }

  {
    await runtime.close()
    const logs = await getLogsFromFile(root)
    ok(logs.some(l => l.msg.includes('x-test')))
  }
})

test('can access Platformatic globals in production mode', async t => {
  const { runtime } = await prepareRuntime(t, 'basepath-production', true, null)
  const url = await startRuntime(t, runtime, null, ['frontend'])

  {
    const { statusCode, body } = await request(url + '/frontend')
    deepStrictEqual(statusCode, 200)

    const text = await body.text()
    ok(text.includes('<code>/frontend<!-- --> <!-- -->true</code>'))
  }
})

test('should not show start in handle mode in production', async t => {
  const { root, runtime } = await prepareRuntime(t, 'standalone', true, null)
  const url = await startRuntime(t, runtime, null, ['frontend'])

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

test('should support Next.js in standalone mode', async t => {
  const { url } = await prepareRuntimeWithBackend(t, 'composer-with-prefix', true, false, ['frontend'], async root => {
    for (const type of ['backend', 'composer']) {
      await cp(resolve(commonFixturesRoot, `${type}-js`), resolve(root, `services/${type}`), {
        recursive: true
      })
    }

    await updateFile(resolve(root, 'services/composer/routes/root.js'), contents => {
      return contents.replace('$PREFIX', '')
    })

    await updateFile(resolve(root, 'services/frontend/next.config.js'), contents => {
      return contents.replace('{}', '{ output: "standalone"}')
    })
  })

  const response = await fetch(url + '/frontend')
  const data = await response.text()
  const mo = data.match(/<div>Hello from v<!-- -->(.+)<\/div>/)
  ok(mo)
})
