import { equal } from 'node:assert'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'
import { createPGDataBase, parseNDJson } from './helper.js'

process.setMaxListeners(100)
setFixturesDir(resolve(import.meta.dirname, './fixtures'))

async function getSpans (spanPaths) {
  const spans = await parseNDJson(spanPaths)
  return spans
}

test('configure telemetry correctly with a express app using pg', async t => {
  const { dropTestDB } = await createPGDataBase()

  t.after(async () => {
    await dropTestDB()
  })

  const { url, root } = await createRuntime(t, 'express-api-pg', false, false, 'platformatic.json')
  const spansPath = join(root, 'spans.log')

  // Test request to add http metrics
  const { statusCode } = await request(`${url}/express/users`, {
    method: 'GET'
  })
  equal(statusCode, 200)
  const spans = await getSpans(spansPath)
  const dbSpan = spans.find(span => span.name === 'pg.query:SELECT test-telemetry-pg')
  const statement = dbSpan.attributes['db.statement']
  equal(statement, 'SELECT * FROM users')
})
