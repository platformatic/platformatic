import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'

test('inject request into service stackable', async t => {
  const stackable = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'))
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  {
    const { statusCode, body } = await stackable.inject('/')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from root' })
  }

  {
    const { statusCode, body } = await stackable.inject('/foo/bar')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from bar' })
  }

  {
    const { statusCode, body } = await stackable.inject('/foo/baz')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from baz' })
  }
})
