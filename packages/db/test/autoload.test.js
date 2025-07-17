import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, getConnectionInfo } from './helper.js'

test('autoload & filesystem based routing / watch disabled', async t => {
  const workingDir = join(import.meta.dirname, 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: false
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from baz', 'body')
  }
})

test('autoload & filesystem based routing / watch enabled', async t => {
  const workingDir = join(import.meta.dirname, 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: true
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from baz', 'body')
  }
})

test('multiple files', async t => {
  const workingDir = join(import.meta.dirname, 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [
        {
          path: join(workingDir, 'plugins')
        },
        {
          path: join(workingDir, 'routes')
        }
      ]
    },
    watch: true
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from baz', 'body')
  }

  {
    const res = await request(`${app.url}/foo/with-decorator`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'bar', 'body')
  }
})

test('multiple files / watch false', async t => {
  const workingDir = join(import.meta.dirname, 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [
        {
          path: join(workingDir, 'plugins')
        },
        {
          path: join(workingDir, 'routes')
        }
      ]
    },
    watch: false
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from baz', 'body')
  }

  {
    const res = await request(`${app.url}/foo/with-decorator`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'bar', 'body')
  }
})

test('multiple files as strings', async t => {
  const workingDir = join(import.meta.dirname, 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'plugins'), join(workingDir, 'routes')]
    },
    watch: true
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from baz', 'body')
  }

  {
    const res = await request(`${app.url}/foo/with-decorator`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'bar', 'body')
  }
})

test('autoload & filesystem based routing / watch disabled / no object', async t => {
  const workingDir = join(import.meta.dirname, 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: false
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from root', 'body')
  }

  {
    const res = await request(`${app.url}/foo/bar`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from bar', 'body')
  }

  {
    const res = await request(`${app.url}/foo/baz`)
    assert.equal(res.statusCode, 200, 'status code')
    const body = await res.body.json()
    assert.equal(body.hello, 'from baz', 'body')
  }
})
