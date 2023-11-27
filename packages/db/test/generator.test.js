'use strict'

const assert = require('node:assert')
const { describe, test } = require('node:test')
const { DBGenerator } = require('../lib/generator/db-generator')

describe('generator', () => {
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
      dependencies: { '@platformatic/db': '^1.10.0' },
      devDependencies: {},
      staticWorkspaceGitHubActions: false,
      dynamicWorkspaceGitHubActions: false,
      isRuntimeContext: false,
      serviceName: '',
      envPrefix: '',
      env: {
        PLT_SERVER_HOSTNAME: '0.0.0.0',
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PORT: 3042,
        DATABASE_URL: 'sqlite://./db.sqlite'
      },
      database: 'sqlite',
      connectionString: 'sqlite://./db.sqlite',
      types: false,
      migrations: 'migrations',
      createMigrations: true,
      applyMigrations: false
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

      const configFile = dbApp.getFileObject('platformatic.db.json')
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
    const platformaticConfigFile = dbApp.getFileObject('platformatic.db.json')
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

    assert.deepEqual(contents.migrations, { dir: 'migrations' })

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

      const configFile = svc.getFileObject('platformatic.db.json')
      const configFileContents = JSON.parse(configFile.contents)
      assert.strictEqual(undefined, configFileContents.server)
      assert.ok(configFile.contents.match(/"connectionString": "{PLT_MY_DB_DATABASE_URL}"/))
    })
  })
})
