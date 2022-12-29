'use strict'

const ConfigManager = require('..')
const { test } = require('tap')

test('transform placeholders', async ({ plan, same }) => {
  plan(2)
  {
    const cm = new ConfigManager({
      source: './file.json',
      env: {
        PLT_FOO: 'bar',
        PLT_USERNAME: 'john'
      }
    })
    const config = {
      server: {
        hostname: '127.0.0.1',
        port: '3042',
        replace: '{PLT_FOO}'
      }
    }

    const res = await cm.replaceEnv(JSON.stringify(config))
    same(JSON.parse(res), {
      server: {
        hostname: '127.0.0.1',
        port: '3042',
        replace: 'bar'
      }
    })
  }

  {
    // shouldn't complain if no placeholders are defined
    const cm = new ConfigManager({
      source: './file.json',
      env: {
        PLT_FOO: 'bar',
        PLT_USERNAME: 'john'
      }
    })

    const config = {
      server: {
        hostname: '127.0.0.1',
        port: '3042'
      }
    }

    const res = await cm.replaceEnv(JSON.stringify(config))
    same(JSON.parse(res), {
      server: {
        hostname: '127.0.0.1',
        port: '3042'
      }
    })
  }
})

test('throws if not all placeholders are defined', async ({ plan, same, throws }) => {
  plan(2)
  const cm = new ConfigManager({
    source: './file.json',
    env: {
      PLT_FOO: 'bar',
      PLT_USERNAME: 'john'
    }
  })

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: '3042',
      replace: '{PLT_FOO}'
    },
    plugin: '{PLT_PLUGIN}'
  }
  try {
    await cm.replaceEnv(JSON.stringify(config))
  } catch (err) {
    same(err.name, 'MissingValueError')
    same(err.message, 'Missing a value for the placeholder: PLT_PLUGIN')
  }
})

test('transform placeholders with newlines', async ({ plan, same }) => {
  const cm = new ConfigManager({
    source: './file.json',
    env: {
      PLT_FOO: 'bar\nbar2\nbar3',
      PLT_USERNAME: 'john\njohn2'
    }
  })
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: '3042',
      replace: '{PLT_FOO}'
    }
  }

  const res = await cm.replaceEnv(JSON.stringify(config))
  same(JSON.parse(res), {
    server: {
      hostname: '127.0.0.1',
      port: '3042',
      replace: 'bar\nbar2\nbar3'
    }
  })
})

test('transform placeholders with `\\`', async ({ plan, same }) => {
  const cm = new ConfigManager({
    source: './file.json',
    env: {
      PLT_FOO: 'bar\\.bar2\\.bar3',
      PLT_USERNAME: 'john\\.john2'
    }
  })
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: '3042',
      replace: '{PLT_FOO}'
    }
  }

  const res = await cm.replaceEnv(JSON.stringify(config))
  same(JSON.parse(res), {
    server: {
      hostname: '127.0.0.1',
      port: '3042',
      replace: 'bar\\.bar2\\.bar3'
    }
  })
})
