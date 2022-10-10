'use strict'

const { test } = require('tap')
const { saveConfigToFile } = require('./helper')
const { unlink, writeFile, mkdir } = require('fs/promises')
const { once } = require('events')
const path = require('path')
const os = require('os')
const ConfigManager = require('..')
const pid = process.pid
const { setTimeout: sleep } = require('timers/promises')

test('should emit event if file is updated', async ({ same, fail, plan, teardown }) => {
  plan(1)
  const config = {
    name: 'Platformatic',
    props: {
      foo: 'bar'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      }
    }
  }

  const file = await saveConfigToFile(config, 'emit-event.json')
  const cm = new ConfigManager({ source: file, schema, watch: true })
  await cm.parse()
  const updatedConfig = {
    name: 'Platformatic Update',
    props: {
      foo: 'foobar'
    }
  }
  await Promise.all([
    once(cm, 'update'),
    writeFile(file, JSON.stringify(updatedConfig))
  ])
  same(cm.current, updatedConfig)
  await cm.stopWatch()
  await unlink(file)
})

test('start & stop cannot be called multiple times', async ({ same, fail, plan, teardown, rejects }) => {
  plan(2)
  const config = {
    name: 'Platformatic',
    props: {
      foo: 'bar'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      }
    }
  }

  const file = await saveConfigToFile(config, 'emit-event.json')
  const cm = new ConfigManager({ source: file, schema })
  await cm.parse()
  const p1 = cm.startWatch()
  const p2 = cm.startWatch()
  same(p1, p2)
  await Promise.all([
    cm.stopWatch(),
    rejects(p1)
  ])
  await cm.stopWatch()
})

test('should emit error for invalid config and not update current', async ({ teardown, fail }) => {
  const config = {
    name: 'Platformatic',
    props: {
      foo: 'bar'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      }
    },
    required: ['name']
  }

  const file = await saveConfigToFile(config)
  teardown(async () => {
    await cm.stopWatch()
    await unlink(file)
  })
  const cm = new ConfigManager({ source: file, schema, watch: true })
  await cm.parse()
  const updatedConfig = {
    props: {
      foo: 'foo',
      bar: '42'
    }
  }
  await Promise.all([
    Promise.race([
      once(cm, 'error'),
      once(cm, 'update').then(() => fail())
    ]),
    writeFile(file, JSON.stringify(updatedConfig))
  ])
})

test('should emit event if .env file is updated', async ({ same, fail, plan, teardown, comment }) => {
  plan(1)
  const tmpDir = path.join(os.tmpdir(), `plt-auth-${pid}`)
  await mkdir(tmpDir)
  const config = {
    name: 'Platformatic',
    props: {
      foo: '{PLT_PROP}'
    }
  }
  const schema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      props: {
        type: 'object',
        properties: {
          foo: { type: 'string' },
          bar: { type: 'integer' }
        }
      }
    }
  }

  const file = path.join(tmpDir, 'uses-env.json')
  const envFile = path.join(tmpDir, '.env')

  await writeFile(envFile, 'PLT_PROP=foo\n')
  await writeFile(file, JSON.stringify(config))

  const cm = new ConfigManager({ source: file, schema, watch: true })
  await cm.parse()
  const updatedConfig = {
    name: 'Platformatic',
    props: {
      foo: 'foobar'
    }
  }
  comment('reloading')
  await Promise.all([
    once(cm, 'update'),
    writeFile(envFile, 'PLT_PROP=foobar')
  ])
  same(cm.current, updatedConfig)
  await cm.stopWatch()
  await unlink(file)
  await unlink(envFile)
})

test('initialize watchIgnore array', async ({ same, plan }) => {
  plan(2)
  {
    const config = {
      core: {
        connectionString: 'sqlite://db.sqlite'
      }
    }
    const file = await saveConfigToFile(config, 'test-watchIgnore.json')
    const cm = new ConfigManager({ source: file, watch: true })
    await cm.parse()
    same(cm.watchIgnore, [])
    await cm.stopWatch()
    await unlink(file)
  }
  {
    const config = {
      core: {
        connectionString: 'sqlite://db.sqlite'
      }
    }
    const file = await saveConfigToFile(config, 'test-watchIgnore.json')
    const cm = new ConfigManager({ source: file, watch: true, watchIgnore: ['foo.bar'] })
    await cm.parse()
    same(cm.watchIgnore, ['foo.bar'])
    await cm.stopWatch()
    await unlink(file)
  }
})

test('return correct files to ignore watch', async ({ equal, same, plan }) => {
  {
    const config = {
      core: {
        connectionString: 'sqlite://db.sqlite'
      }
    }
    const file = await saveConfigToFile(config, 'test-watchIgnore.json')
    const cm = new ConfigManager({
      source: file,
      allowedToWatch: ['*'],
      watchIgnore: ['test.file', 'test2.file']
    })
    equal(false, cm.shouldFileBeWatched('test.file'))
    equal(false, cm.shouldFileBeWatched('test2.file'))
    await unlink(file)
  }

  {
    const config = {
      core: {
        connectionString: 'sqlite://db.sqlite'
      }
    }
    const file = await saveConfigToFile(config, 'test-watchIgnore.json')
    const cm = new ConfigManager({
      source: file,
      allowedToWatch: ['*'],
      watchIgnore: ['test.file', 'test2.file']
    })
    equal(true, cm.shouldFileBeWatched('another.file'))
    await unlink(file)
  }
})

test('do not emit event for ignored files', async ({ teardown, equal, same, fail }) => {
  const configFile = path.join(__dirname, 'fixtures', 'simple.json')
  const cm = new ConfigManager({
    source: configFile,
    schema: {},
    watch: true,
    watchIgnore: ['test.file']
  })
  const parseResult = await cm.parse()
  equal(parseResult, true)
  const testFileFullPath = `${path.join(path.dirname(cm.fullPath))}/test.file`
  cm.on('update', () => {
    fail()
  })
  await writeFile(testFileFullPath, 'foobar')

  teardown(async () => {
    await cm.stopWatch()
    await unlink(testFileFullPath)
  })

  same(cm.watchIgnore, ['test.file'])

  // await a full event loop cycle to make sure all possible updates
  // have been processed.
  await sleep(150)
})

test('emit event for not-ignored files', async ({ teardown, equal, same, pass, fail }) => {
  const configFile = path.join(__dirname, 'fixtures', 'simple.json')
  const cm = new ConfigManager({
    source: configFile,
    schema: {},
    watch: true,
    allowedToWatch: ['*'],
    watchIgnore: ['test.file']
  })
  let eventEmitted = false
  const parseResult = await cm.parse()
  equal(parseResult, true)
  const testFileFullPath = `${path.join(path.dirname(cm.fullPath))}/test2.file`
  cm.on('update', () => {
    pass()
    eventEmitted = true
  })
  await writeFile(testFileFullPath, 'foobar')

  teardown(async () => {
    await cm.stopWatch()
    await unlink(testFileFullPath)
  })

  same(cm.watchIgnore, ['test.file'])

  // await a full event loop cycle to make sure all possible updates
  // have been processed.
  await sleep(150)
  equal(eventEmitted, true)
})
