import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { create } from '../index.js'

// Make sure we are not mistakenly detecting the tsconfig.json file in the root of the package.
process.chdir(import.meta.dirname)

test('autoload & filesystem based routing / watch disabled', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'directories', 'routes')]
    },
    watch: false
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from baz', 'body')
  }
})

test('multiple files / watch false', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [
        {
          path: join(import.meta.dirname, 'fixtures', 'directories', 'plugins')
        },
        {
          path: join(import.meta.dirname, 'fixtures', 'directories', 'routes')
        }
      ]
    },
    watch: false
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from baz', 'body')
  }

  {
    const res = await request(`${app.url}/foo/with-decorator`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'bar', 'body')
  }
})

test('autoload & filesystem based routing / watch disabled / no object', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'directories', 'routes')]
    },
    watch: false
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from baz', 'body')
  }
})

test('multiple files / watch false / no object', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [
        join(import.meta.dirname, 'fixtures', 'directories', 'plugins'),
        join(import.meta.dirname, 'fixtures', 'directories', 'routes')
      ]
    },
    watch: false
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from baz', 'body')
  }

  {
    const res = await request(`${app.url}/foo/with-decorator`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'bar', 'body')
  }
})

test('nested directories', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      // Windows CI is slow
      pluginTimeout: 60 * 1000
    },
    service: {
      openapi: true
    },
    plugins: {
      paths: [
        {
          path: join(import.meta.dirname, 'fixtures', 'nested-directories', 'plugins'),
          encapsulate: false
        },
        {
          path: join(import.meta.dirname, 'fixtures', 'nested-directories', 'modules'),
          encapsulate: false,
          maxDepth: 1
        }
      ]
    }
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'nested-directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/inventory/product/42`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.deepStrictEqual(body, { sku: 42, inStore: 2 }, 'body')
  }

  {
    const res = await request(`${app.url}/catalogue/products`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.deepStrictEqual(
      body,
      [
        { sku: 42, name: 'foo', inStore: 2 },
        { sku: 43, name: 'bar', inStore: 0 }
      ],
      'body'
    )
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.strictEqual(res.statusCode, 404, 'status code')
    const body = await res.body.text()
    assert.strictEqual(body, "I'm sorry, I couldn't find what you were looking for.")
  }

  {
    const res = await request(`${app.url}/catalogue/error`)
    assert.strictEqual(res.statusCode, 500, 'status code')
    const body = await res.body.text()
    assert.strictEqual(body, "I'm sorry, there was an error processing your request.")
  }
})

test('disable encapsulation for a single file', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      // Windows CI is slow
      pluginTimeout: 60 * 1000
    },
    service: {
      openapi: true
    },
    plugins: {
      paths: [
        {
          path: join(import.meta.dirname, 'fixtures', 'nested-directories', 'plugins', 'decorator.js'),
          encapsulate: false
        },
        {
          path: join(import.meta.dirname, 'fixtures', 'nested-directories', 'plugins', 'handlers.js'),
          encapsulate: false
        },
        {
          path: join(import.meta.dirname, 'fixtures', 'nested-directories', 'modules'),
          encapsulate: false,
          maxDepth: 1
        }
      ]
    }
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'nested-directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.strictEqual(res.statusCode, 404, 'status code')
    const body = await res.body.text()
    assert.strictEqual(body, "I'm sorry, I couldn't find what you were looking for.")
  }

  {
    const res = await request(`${app.url}/foo`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.text()
    assert.strictEqual(body, 'bar')
  }
})

test('disable encapsulation for a single file / different order', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      // Windows CI is slow
      pluginTimeout: 60 * 1000
    },
    service: {
      openapi: true
    },
    plugins: {
      paths: [
        {
          path: join(import.meta.dirname, 'fixtures', 'nested-directories', 'modules'),
          encapsulate: false,
          maxDepth: 1
        },
        {
          path: join(import.meta.dirname, 'fixtures', 'nested-directories', 'plugins', 'decorator.js'),
          encapsulate: false
        },
        {
          path: join(import.meta.dirname, 'fixtures', 'nested-directories', 'plugins', 'handlers.js'),
          encapsulate: false
        }
      ]
    }
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'nested-directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.strictEqual(res.statusCode, 404, 'status code')
    const body = await res.body.text()
    assert.strictEqual(body, "I'm sorry, I couldn't find what you were looking for.")
  }

  {
    const res = await request(`${app.url}/foo`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.text()
    assert.strictEqual(body, 'bar')
  }
})

test('autoload with ignorePattern, indexPattern and autoHooksPattern options', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [
        {
          path: join(import.meta.dirname, 'fixtures', 'directories', 'routes'),

          // Ignore the bar.js which should return a 404 for requests made to /bar
          ignorePattern: '^.*(?:bar).js$',

          // Set index2.js as the index file which sets the root as /index2
          indexPattern: '^index2(?:.js)$',

          // Override default autohooks.js with auto.hooks.js which overrides
          // the response body
          autoHooksPattern: '^auto.hooks.js$',
          autoHooks: true
        }
      ]
    },
    watch: false
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.strictEqual(res.statusCode, 404, 'status code')
  }

  {
    const res = await request(`${app.url}/foo/baz/index2`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from baz with index2.js', 'body')
  }

  {
    const res = await request(`${app.url}/oof`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.strictEqual(body.hello, 'from auto.hooks.js', 'body')
  }
})

test('autoload with INVALID ignorePattern, indexPattern and autoHooksPattern options', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [
        {
          path: join(import.meta.dirname, 'fixtures', 'directories', 'routes'),
          ignorePattern: '***',
          indexPattern: '***terrible)))_pattern',
          autoHooksPattern: ''
        }
      ]
    },
    watch: false
  }

  const app = await create(join(import.meta.dirname, 'fixtures', 'directories'), config)
  t.after(() => app.stop())
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200, 'status code')
  }
})

test('loads encapsulated plugin twice', async t => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      // Windows CI is slow
      pluginTimeout: 60 * 1000
    },
    service: {
      openapi: true
    },
    plugins: {
      paths: [
        {
          path: join(import.meta.dirname, 'fixtures', 'directories', 'routes')
        },
        {
          path: join(import.meta.dirname, 'fixtures', 'directories', 'plugins', 'decorator.js')
        }
      ]
    }
  }

  {
    // First time plugin is loaded from file
    const app = await create(join(import.meta.dirname, 'fixtures', 'directories'), config)
    t.after(async () => {
      await app.stop()
    })
    await app.start({ listen: true })

    const res = await request(`${app.url}/foo/with-decorator`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.deepStrictEqual(body, { hello: 'bar' })
  }

  {
    // Second time plugin is loaded from cache
    const app = await create(join(import.meta.dirname, 'fixtures', 'directories'), config)
    t.after(async () => {
      await app.stop()
    })
    await app.start({ listen: true })

    const res = await request(`${app.url}/foo/with-decorator`)
    assert.strictEqual(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.deepStrictEqual(body, { hello: 'bar' })
  }
})
