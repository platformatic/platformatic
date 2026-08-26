import { deepStrictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareRuntime, setFixturesDir, startRuntime } from '../../basic/test/helper.js'
import { updateConfigFile } from '../../runtime/test/helpers.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('when trailingSlash is false, request with a trailing slash are redirected', async t => {
  const { runtime } = await prepareRuntime({
    t,
    root: resolve(import.meta.dirname, 'fixtures/server-side-standalone'),
    port: 0
  })
  const url = await startRuntime(t, runtime)

  {
    const { statusCode } = await request(url)
    deepStrictEqual(statusCode, 200)
  }

  {
    const { statusCode } = await request(url + '/')
    deepStrictEqual(statusCode, 200)
  }

  {
    const { statusCode } = await request(url + '/direct/')
    deepStrictEqual(statusCode, 308)
  }

  {
    const { statusCode } = await request(url + '/direct')
    deepStrictEqual(statusCode, 200)
  }
})

test('when trailingSlash is true, request without a trailing slash are redirected', async t => {
  const { runtime } = await prepareRuntime({
    t,
    root: resolve(import.meta.dirname, 'fixtures/server-side-standalone'),
    port: 0,
    additionalSetup: async root => {
      await updateConfigFile(resolve(root, 'services/frontend/platformatic.application.json'), contents => {
        contents.next = { trailingSlash: true }
      })
    }
  })

  const url = await startRuntime(t, runtime)

  {
    const { statusCode } = await request(url)
    deepStrictEqual(statusCode, 200)
  }

  {
    const { statusCode } = await request(url + '/')
    deepStrictEqual(statusCode, 200)
  }

  {
    const { statusCode } = await request(url + '/direct/')
    deepStrictEqual(statusCode, 200)
  }

  {
    const { statusCode } = await request(url + '/direct')
    deepStrictEqual(statusCode, 308)
  }
})
