'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { Generator } = require('../lib/generator')

const { MockAgent, setGlobalDispatcher } = require('undici')

const mockAgent = new MockAgent()
setGlobalDispatcher(mockAgent)
mockAgent.disableNetConnect()

test('should export a Generator property', async () => {
  const svc = new Generator()
  assert.equal(svc.module, '@platformatic/db')
})

test('should have default config', async () => {
  const dbApp = new Generator()
  await dbApp.prepare()

  assert.deepEqual(dbApp.config, {
    port: 3042,
    hostname: '0.0.0.0',
    plugin: true,
    tests: true,
    typescript: false,
    initGitRepository: false,
    dependencies: { '@platformatic/db': `^${dbApp.platformaticVersion}` },
    devDependencies: {},
    isRuntimeContext: false,
    serviceName: '',
    envPrefix: '',
    env: {
      PLT_SERVER_HOSTNAME: '0.0.0.0',
      PLT_APPLY_MIGRATIONS: 'true',
      PLT_SERVER_LOGGER_LEVEL: 'info',
      PORT: 3042,
      DATABASE_URL: 'sqlite://./db.sqlite',
      PLT_TYPESCRIPT: false
    },
    defaultEnv: {
      DATABASE_URL: 'sqlite://./db.sqlite',
      PLT_APPLY_MIGRATIONS: 'true',
      PLT_SERVER_HOSTNAME: '0.0.0.0',
      PLT_SERVER_LOGGER_LEVEL: 'info',
      PLT_TYPESCRIPT: false,
      PORT: 3042
    },
    database: 'sqlite',
    connectionString: 'sqlite://./db.sqlite',
    types: true,
    migrations: 'migrations',
    createMigrations: true,
    isUpdating: false
  })
})

test('generate correct .env file', async t => {
  const dbApp = new Generator()
  await dbApp.prepare()
  {
    const dotEnvFile = dbApp.getFileObject('.env')
    assert.equal(
      dotEnvFile.contents,
      [
        'PLT_SERVER_HOSTNAME=0.0.0.0',
        'PLT_SERVER_LOGGER_LEVEL=info',
        'PORT=3042',
        'PLT_TYPESCRIPT=false',
        'DATABASE_URL=sqlite://./db.sqlite',
        'PLT_APPLY_MIGRATIONS=true',
        ''
      ].join('\n')
    )
  }

  {
    dbApp.setConfig({
      typescript: true
    })

    await dbApp.prepare()

    const configFile = dbApp.getFileObject('platformatic.json')
    const configFileJson = JSON.parse(configFile.contents)
    assert.equal(configFileJson.plugins.typescript, '{PLT_TYPESCRIPT}')

    const dotEnvFile = dbApp.getFileObject('.env')
    assert.ok(dotEnvFile.contents.includes('PLT_TYPESCRIPT=true'))
  }

  {
    // with envPrefix
    dbApp.setConfig({
      isRuntimeContext: true,
      envPrefix: 'PREFIX'
    })

    const appEnv = await dbApp.prepare()

    // no .env file is generated
    const dotEnvFile = dbApp.getFileObject('.env')
    assert.equal(null, dotEnvFile)
    assert.equal(appEnv.env.PLT_PREFIX_DATABASE_URL, 'sqlite://./db.sqlite')
  }
})

test('have @platformatic/db dependency', async t => {
  const dbApp = new Generator()
  await dbApp.prepare()
  const packageJsonFileObject = dbApp.getFileObject('package.json')
  const contents = JSON.parse(packageJsonFileObject.contents)
  assert.ok(contents.dependencies['@platformatic/db'])
})

test('have plt-env.d.ts', async t => {
  const dbApp = new Generator()
  await dbApp.prepare()
  const environment = dbApp.getFileObject('plt-env.d.ts')

  const ENVIRONMENT_TEMPLATE = `
import { FastifyInstance } from 'fastify'
import { PlatformaticApplication, PlatformaticDatabaseConfig, PlatformaticDatabaseMixin, Entities } from '@platformatic/db'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApplication<PlatformaticDatabaseConfig> & PlatformaticDatabaseMixin<Entities>
  }
}
`
  assert.equal(ENVIRONMENT_TEMPLATE, environment.contents)
})

test('config', async t => {
  const dbApp = new Generator()
  dbApp.setConfig({
    typescript: true,
    types: true
  })
  await dbApp.prepare()
  const platformaticConfigFile = dbApp.getFileObject('platformatic.json')
  const contents = JSON.parse(platformaticConfigFile.contents)
  assert.equal(contents.$schema, `https://schemas.platformatic.dev/@platformatic/db/${dbApp.platformaticVersion}.json`)
  assert.deepEqual(contents.server, {
    hostname: '{PLT_SERVER_HOSTNAME}',
    port: '{PORT}',
    logger: { level: '{PLT_SERVER_LOGGER_LEVEL}' }
  })

  assert.deepEqual(contents.db, {
    connectionString: '{DATABASE_URL}',
    graphql: true,
    openapi: true,
    schemalock: true
  })

  assert.deepEqual(contents.migrations, { autoApply: '{PLT_APPLY_MIGRATIONS}', dir: 'migrations' })

  assert.deepEqual(contents.types, { autogenerate: true })
})
test('generate tests with correct helper', async t => {
  const dbApp = new Generator()

  {
    // sqlite
    dbApp.setConfig({
      typescript: true
    })
    await dbApp.prepare()

    // check tests file are created
    const exampleTest = dbApp.getFileObject('helper.ts', 'test')

    assert.ok(
      exampleTest.contents.includes(
        "const dbPath = join(os.tmpdir(), 'db-' + process.pid + '-' + counter++ + '.sqlite')"
      )
    )
  }

  {
    // sqlite with javascript
    dbApp.setConfig({
      typescript: false
    })
    await dbApp.prepare()

    // check tests file are created
    const exampleTest = dbApp.getFileObject('helper.js', 'test')

    assert.ok(
      exampleTest.contents.includes(
        "const dbPath = join(os.tmpdir(), 'db-' + process.pid + '-' + counter++ + '.sqlite')"
      )
    )
  }

  {
    // mysql
    dbApp.setConfig({
      typescript: true,
      database: 'mysql'
    })
    await dbApp.prepare()

    // check tests file are created
    const exampleTest = dbApp.getFileObject('helper.ts', 'test')
    assert.ok(
      exampleTest.contents.includes(`
  t.after(async () => {
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })`)
    )
  }

  {
    // mariadb
    dbApp.setConfig({
      typescript: true,
      database: 'mariadb'
    })
    await dbApp.prepare()

    // check tests file are created
    const exampleTest = dbApp.getFileObject('helper.ts', 'test')
    assert.ok(
      exampleTest.contents.includes(`
  t.after(async () => {
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })`)
    )
  }

  {
    // postgres
    dbApp.setConfig({
      typescript: true,
      database: 'postgres'
    })
    await dbApp.prepare()

    // check tests file are created
    const exampleTest = dbApp.getFileObject('helper.ts', 'test')
    assert.ok(
      exampleTest.contents.includes(`
  t.after(async () => {
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })`)
    )
  }
})

test('should have default connection string', async t => {
  const dbApp = new Generator()

  dbApp.setConfig({
    database: 'postgres'
  })

  await dbApp.prepare()
  assert.equal(dbApp.config.connectionString, 'postgres://postgres:postgres@127.0.0.1:5432/postgres')
})

test('should return config fields', async () => {
  const svc = new Generator()
  assert.deepEqual(svc.getConfigFieldsDefinitions(), [
    {
      var: 'DATABASE_URL',
      label: 'What is the connection string?',
      default: svc.connectionStrings.sqlite,
      type: 'string',
      configValue: 'connectionString'
    },
    {
      default: true,
      label: 'Should migrations be applied automatically on startup?',
      type: 'boolean',
      var: 'PLT_APPLY_MIGRATIONS'
    }
  ])
})

test('should get database from connectionString', async () => {
  const svc = new Generator()

  svc.setConfig({
    connectionString: 'mydb://foobar.com'
  })
  assert.equal(svc.getDatabaseFromConnectionString(), 'mydb')
  svc.setConfig({
    connectionString: 'bad_connection_string'
  })
  assert.equal(svc.getDatabaseFromConnectionString(), null)
  svc.setConfig({
    connectionString: null
  })
  assert.equal(svc.getDatabaseFromConnectionString(), null)
})
test('should set config fields', async () => {
  const svc = new Generator()
  svc.setConfigFields([
    {
      var: 'DATABASE_URL',
      configValue: 'connectionString',
      value: 'sqlite123://./db.sqlite'
    }
  ])

  assert.equal(svc.config.database, 'sqlite123')
})

test('support packages', async t => {
  {
    const svc = new Generator()
    const packageDefinitions = [
      {
        name: '@fastify/compress',
        options: [
          {
            path: 'threshold',
            value: '1',
            type: 'number'
          },
          {
            path: 'foobar',
            value: '123',
            type: 'number',
            name: 'FST_PLUGIN_STATIC_FOOBAR'
          }
        ]
      }
    ]
    svc.setConfig({
      isRuntimeContext: true,
      serviceName: 'my-db',
      plugin: false
    })
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const platformaticConfigFile = svc.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)

    assert.deepEqual(contents.plugins, {
      packages: [
        {
          name: '@fastify/compress',
          options: {
            threshold: 1,
            foobar: '{PLT_MY_DB_FST_PLUGIN_STATIC_FOOBAR}'
          }
        }
      ]
    })

    assert.equal(svc.config.env.PLT_MY_DB_FST_PLUGIN_STATIC_FOOBAR, 123)
  }
  {
    // with standard platformatic plugin
    const svc = new Generator()
    const packageDefinitions = [
      {
        name: '@fastify/compress',
        options: [
          {
            path: 'threshold',
            value: '1',
            type: 'number'
          }
        ]
      }
    ]
    await svc.addPackage(packageDefinitions[0])
    await svc.prepare()

    const platformaticConfigFile = svc.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)

    assert.deepEqual(contents.plugins, {
      paths: [
        {
          encapsulate: false,
          path: './plugins'
        },
        {
          path: './routes'
        }
      ],
      packages: [
        {
          name: '@fastify/compress',
          options: {
            threshold: 1
          }
        }
      ],
      typescript: '{PLT_TYPESCRIPT}'
    })
  }
})

test('runtime context should have env prefix', async t => {
  const svc = new Generator()
  svc.setConfig({
    isRuntimeContext: true,
    serviceName: 'my-db',
    env: {
      FOO: 'bar',
      BAZ: 'baz'
    }
  })
  assert.deepEqual(svc.config.env, {
    PLT_MY_DB_FOO: 'bar',
    PLT_MY_DB_BAZ: 'baz'
  })

  await svc.prepare()

  // no env file is generated
  assert.equal(null, svc.getFileObject('.env'))
})

test('runtime context should not have server.config', async t => {
  const svc = new Generator()
  svc.setConfig({
    isRuntimeContext: true,
    serviceName: 'my-db',
    env: {
      FOO: 'bar',
      BAZ: 'baz'
    }
  })

  await svc.prepare()

  const configFile = svc.getFileObject('platformatic.json')
  const configFileContents = JSON.parse(configFile.contents)
  assert.strictEqual(undefined, configFileContents.server)
  assert.ok(configFile.contents.match(/"connectionString": "{PLT_MY_DB_DATABASE_URL}"/))
})
