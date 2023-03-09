'use strict'

const { test } = require('tap')
const { analyze } = require('..')
const { join } = require('path')
const { readFile } = require('fs').promises
const YAML = require('yaml')

test('simple', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'platformatic.db.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'db')
  t.same(meta.config, JSON.parse(await readFile(file)))
  t.equal(meta.path, file)
  t.equal(meta.format, 'json')

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'db')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/db')
  t.equal(meta17.format, 'json')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: ['plugin.js']
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'db')
    t.equal(meta17FromScratch.path, undefined)
    t.equal(meta17FromScratch.format, 'json')
  }
})

test('typescript', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'config-ts.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'db')
  t.same(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'db')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/db')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: ['plugin.ts'],
    typescript: true
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'db')
  }
})

test('service', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'platformatic.service.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'service')
  t.same(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'service')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: ['plugin.js']
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'service')
  }
})

test('array of plugins', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'array.service.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'service')
  t.same(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'service')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: ['./plugins/index.js', './routes']
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'service')
  }
})

test('no plugin', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'no-plugin.db.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'db')
  t.same(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'db')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/db')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, undefined)
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'db')
  }
})

test('array of plugins (strings)', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'array-string.service.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'service')
  t.same(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'service')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: ['./plugins/index.js', './routes']
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'service')
  }
})

test('single string', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'single-string.service.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'service')
  t.same(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'service')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: ['plugin.js']
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'service')
  }
})

test('plugin options', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'options.service.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'service')
  t.same(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'service')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: [{
      path: 'plugin.js',
      options: {
        something: 'else'
      }
    }],
    hotReload: true,
    stopTimeout: 10000
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'service')
  }
})

test('plugin options (array)', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'options-array.service.json')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'service')
  t.same(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'service')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: [{
      path: 'plugin.ts',
      options: {
        something: 'else'
      }
    }, {
      path: 'other.js',
      options: {
        foo: 'bar'
      }
    }],
    // We take the values from the first plugin
    hotReload: true,
    stopTimeout: 10000,
    typescript: true
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'service')
  }
})

test('yaml loading', async (t) => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'single-string.service.yaml')
  const meta = await analyze({ file })
  t.equal(meta.version, '0.16.0')
  t.equal(meta.kind, 'service')
  t.same(meta.config, YAML.parse(await readFile(file, 'utf8')))
  t.equal(meta.format, 'yaml')

  const meta17 = meta.up()
  t.equal(meta17.version, '0.17.0')
  t.equal(meta17.kind, 'service')
  t.equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')
  t.equal(meta.format, 'yaml')

  t.notSame(meta.config, meta17.config)

  t.match(meta17.config.plugins, {
    paths: ['plugin.js']
  })
  t.equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    t.equal(meta17FromScratch.version, '0.17.0')
    t.equal(meta17FromScratch.kind, 'service')
    t.equal(meta17FromScratch.format, 'json')
  }
})
