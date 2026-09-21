import { ok, strictEqual } from 'node:assert'
import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import {
  buildRuntime,
  commonFixturesRoot,
  prepareRuntime,
  setAdditionalDependencies,
  setFixturesDir,
  startRuntime,
  updateFile
} from '../../basic/test/helper.js'
import { additionalDependencies } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))
setAdditionalDependencies(additionalDependencies)

function decodeHtmlEntities (str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
}

test('fetch() should work with string URL and Request object in Nuxt app', async t => {
  const { runtime, root } = await prepareRuntime(t, 'fetch-test', true, null, async root => {
    for (const type of ['backend', 'composer']) {
      await cp(resolve(commonFixturesRoot, `${type}-js`), resolve(root, `services/${type}`), {
        recursive: true
      })
    }

    await updateFile(resolve(root, 'services/composer/routes/root.js'), contents => {
      return contents.replace('$PREFIX', '/frontend')
    })
  })

  await buildRuntime(root)

  const url = await startRuntime(t, runtime)

  const response = await request(`${url}/frontend/`)
  strictEqual(response.statusCode, 200, `Expected 200 but got ${response.statusCode}`)

  const html = await response.body.text()
  ok(html.includes('Hello from v'), 'Page should render successfully')

  const preMatch = html.match(/<pre[^>]*id="fetch-results"[^>]*>([\s\S]*?)<\/pre>/)
  ok(preMatch, 'Should find fetch-results pre tag')

  const decoded = decodeHtmlEntities(preMatch[1].trim())
  const fetchResults = JSON.parse(decoded)

  ok(
    fetchResults.stringUrl?.ok === true,
    `fetch with string URL should succeed: ${JSON.stringify(fetchResults.stringUrl)}`
  )
  ok(
    fetchResults.requestObject?.ok === true,
    `fetch with Request object should succeed: ${JSON.stringify(fetchResults.requestObject)}`
  )
})
