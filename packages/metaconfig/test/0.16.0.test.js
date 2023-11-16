'use strict'

const { test } = require('node:test')
const { equal, deepEqual, notDeepEqual } = require('node:assert')
const { analyze } = require('..')
const { join } = require('path')
const { readFile } = require('fs').promises
const YAML = require('yaml')

test('simple', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'platformatic.db.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'db')
  deepEqual(meta.config, JSON.parse(await readFile(file)))
  equal(meta.path, file)
  equal(meta.format, 'json')

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'db')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/db')
  equal(meta17.format, 'json')

  notDeepEqual(meta.config, meta17.config)
  deepEqual(meta17.config.plugins, {
    paths: ['plugin.js']
  })
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'db')
    equal(meta17FromScratch.path, undefined)
    equal(meta17FromScratch.format, 'json')
  }
})

test('typescript', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'config-ts.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'db')
  deepEqual(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'db')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/db')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, {
    paths: ['plugin.ts'],
    typescript: true
  })
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'db')
  }
})

test('service', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'platformatic.service.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'service')
  deepEqual(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'service')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, {
    paths: ['plugin.js']
  })
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'service')
  }
})

test('array of plugins', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'array.service.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'service')
  deepEqual(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'service')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, {
    paths: ['./plugins/index.js', './routes/']
  })
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'service')
  }
})

test('no plugin', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'no-plugin.db.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'db')
  deepEqual(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'db')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/db')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, undefined)
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'db')
  }
})

test('array of plugins (strings)', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'array-string.service.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'service')
  deepEqual(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'service')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, {
    paths: ['./plugins/index.js', './routes/']
  })
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'service')
  }
})

test('single string', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'single-string.service.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'service')
  deepEqual(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'service')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, {
    paths: ['plugin.js']
  })
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'service')
  }
})

test('plugin options', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'options.service.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'service')
  deepEqual(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'service')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, {
    paths: [{
      path: 'plugin.js',
      options: {
        something: 'else'
      }
    }],
    hotReload: true,
    stopTimeout: 10000
  })
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'service')
  }
})

test('plugin options (array)', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'options-array.service.json')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'service')
  deepEqual(meta.config, JSON.parse(await readFile(file)))

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'service')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, {
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
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'service')
  }
})

test('yaml loading', async () => {
  const file = join(__dirname, 'fixtures', 'v0.16.0', 'single-string.service.yaml')
  const meta = await analyze({ file })
  equal(meta.version, '0.16.0')
  equal(meta.kind, 'service')
  deepEqual(meta.config, YAML.parse(await readFile(file, 'utf8')))
  equal(meta.format, 'yaml')

  const meta17 = meta.up()
  equal(meta17.version, '0.17.0')
  equal(meta17.kind, 'service')
  equal(meta17.config.$schema, 'https://platformatic.dev/schemas/v0.17.0/service')
  equal(meta.format, 'yaml')

  notDeepEqual(meta.config, meta17.config)

  deepEqual(meta17.config.plugins, {
    paths: ['plugin.js']
  })
  equal(meta17.config.plugin, undefined)

  {
    const meta17FromScratch = await analyze({ config: meta17.config })
    equal(meta17FromScratch.version, '0.17.0')
    equal(meta17FromScratch.kind, 'service')
    equal(meta17FromScratch.format, 'json')
  }
})
