'use strict'

const assert = require('node:assert')
const { describe, test } = require('node:test')
const { DBGenerator, Generator } = require('../lib/generator/db-generator')

describe('generator', () => {
  test('should export a Generator property', async () => {
    const svc = new Generator()
    assert.equal(svc.module, '@platformatic/db')
  })
  test('should have default config', async () => {
    const dbApp = new DBGenerator()
    await dbApp.prepare()

    assert.deepEqual(dbApp.config, {
      port: 3042,
      hostname: '0.0.0.0',
      plugin: false,
      tests: false,
      typescript: false,
      initGitRepository: false,
      dependencies: { '@platformatic/db': `^${dbApp.platformaticVersion}` },
      devDependencies: {},
      staticWorkspaceGitHubActions: false,
      dynamicWorkspaceGitHubActions: false,
      isRuntimeContext: false,
      serviceName: '',
      envPrefix: '',
      env: {
        PLT_SERVER_HOSTNAME: '0.0.0.0',
        PLT_APPLY_MIGRATIONS: 'true',
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PORT: 3042,
        DATABASE_URL: 'sqlite://./db.sqlite'
      },
      database: 'sqlite',
      connectionString: 'sqlite://./db.sqlite',
      types: false,
      migrations: 'migrations',
      createMigrations: true
    })
  })
  test('generate correct .env file', async (t) => {
    const dbApp = new DBGenerator()
    await dbApp.prepare()
    {
      const dotEnvFile = dbApp.getFileObject('.env')
      assert.equal(dotEnvFile.contents, [

        'PLT_SERVER_HOSTNAME=0.0.0.0',
        'PLT_SERVER_LOGGER_LEVEL=info',
        'PLT_APPLY_MIGRATIONS=true',
        'PORT=3042',
        'DATABASE_URL=sqlite://./db.sqlite',
        ''
      ].join('\n'))
    }

    {
      dbApp.setConfig({
        typescript: true,
        plugin: true
      })

      await dbApp.prepare()

      const configFile = dbApp.getFileObject('platformatic.json')
      const configFileJson = JSON.parse(configFile.contents)
      assert.equal(configFileJson.plugins.typescript, true)
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

  test('have @platformatic/db dependency', async (t) => {
    const dbApp = new DBGenerator()
    await dbApp.prepare()
    const packageJsonFileObject = dbApp.getFileObject('package.json')
    const contents = JSON.parse(packageJsonFileObject.contents)
    assert.equal(contents.dependencies['@platformatic/db'], contents.dependencies.platformatic)
  })

  test('config', async (t) => {
    const dbApp = new DBGenerator()
    dbApp.setConfig({
      typescript: true,
      types: true
    })
    await dbApp.prepare()
    const platformaticConfigFile = dbApp.getFileObject('platformatic.json')
    const contents = JSON.parse(platformaticConfigFile.contents)
    assert.equal(contents.$schema, `https://platformatic.dev/schemas/v${dbApp.platformaticVersion}/db`)
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
  test('generate tests with correct helper', async (t) => {
    const dbApp = new DBGenerator()

    {
      // sqlite
      dbApp.setConfig({
        typescript: true,
        plugin: true
      })
      await dbApp.prepare()

      // check tests file are created
      const exampleTest = dbApp.getFileObject('helper.ts', 'test')

      assert.ok(exampleTest.contents.includes('const dbPath = join(os.tmpdir(), \'db-\' + process.pid + \'-\' + counter++ + \'.sqlite\')'))
    }

    {
      // sqlite with javascript
      dbApp.setConfig({
        typescript: false,
        plugin: true
      })
      await dbApp.prepare()

      // check tests file are created
      const exampleTest = dbApp.getFileObject('helper.js', 'test')

      assert.ok(exampleTest.contents.includes('const dbPath = join(os.tmpdir(), \'db-\' + process.pid + \'-\' + counter++ + \'.sqlite\')'))
    }

    {
      // mysql
      dbApp.setConfig({
        typescript: true,
        plugin: true,
        database: 'mysql'
      })
      await dbApp.prepare()

      // check tests file are created
      const exampleTest = dbApp.getFileObject('helper.ts', 'test')
      assert.ok(exampleTest.contents.includes(`
  t.after(async () => {
    t.diagnostic('Disposing test database ' + newDB)
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })`))
    }

    {
      // mariadb
      dbApp.setConfig({
        typescript: true,
        plugin: true,
        database: 'mariadb'
      })
      await dbApp.prepare()

      // check tests file are created
      const exampleTest = dbApp.getFileObject('helper.ts', 'test')
      assert.ok(exampleTest.contents.includes(`
  t.after(async () => {
    t.diagnostic('Disposing test database ' + newDB)
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })`))
    }

    {
      // postgres
      dbApp.setConfig({
        typescript: true,
        plugin: true,
        database: 'postgres'
      })
      await dbApp.prepare()

      // check tests file are created
      const exampleTest = dbApp.getFileObject('helper.ts', 'test')
      assert.ok(exampleTest.contents.includes(`
  t.after(async () => {
    t.diagnostic('Disposing test database ' + newDB)
    await db.query(sql\`
      DROP DATABASE \${sql.ident(newDB)}
    \`)
    await db.dispose()
  })`))
    }
  })

  test('should have default connection string', async (t) => {
    const dbApp = new DBGenerator()

    dbApp.setConfig({
      database: 'postgres'
    })

    await dbApp.prepare()
    assert.equal(dbApp.config.connectionString, 'postgres://postgres:postgres@127.0.0.1:5432/postgres')
  })

  test('should return config fields', async () => {
    const svc = new DBGenerator()
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
    const svc = new DBGenerator()

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
    const svc = new DBGenerator()
    svc.setConfigFields([
      {
        var: 'DATABASE_URL',
        configValue: 'connectionString',
        value: 'sqlite123://./db.sqlite'
      }
    ])

    assert.equal(svc.config.database, 'sqlite123')
  })

  test('support packages', async (t) => {
    {
      const svc = new DBGenerator()
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
        serviceName: 'my-db'
      })
      svc.addPackage(packageDefinitions[0])
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
      const svc = new DBGenerator()
      svc.setConfig({
        plugin: true
      })
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
      svc.addPackage(packageDefinitions[0])
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
        ]
      })
    }
  })
  describe('runtime context', () => {
    test('should have env prefix', async (t) => {
      const svc = new DBGenerator()
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

    test('should not have server.config', async (t) => {
      const svc = new DBGenerator()
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
  })
})
