import { deepStrictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { prepareRuntime, setFixturesDir, startRuntime, updateFile } from '../../basic/test/helper.js'

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('when trailingSlash is false, request with a trailing slash are redirected', async t => {
  const { runtime } = await prepareRuntime(t, 'server-side-standalone', false)
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
  const { runtime } = await prepareRuntime(t, 'server-side-standalone', false, null, async root => {
    await updateFile(resolve(root, 'services/frontend/platformatic.application.json'), contents => {
      const json = JSON.parse(contents)
      json.next = { trailingSlash: true }
      return JSON.stringify(json, null, 2)
    })
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
