'use strict'

const { BaseGenerator, generateTests, addPrefixToEnv } = require('@platformatic/generators')
const { jsHelperSqlite, jsHelperMySQL, jsHelperPostgres, moviesTestTS, moviesTestJS } = require('./code-templates')
const { join } = require('node:path')
const { readFile } = require('node:fs/promises')

class DBGenerator extends BaseGenerator {
  constructor (opts = {}) {
    super({
      ...opts,
      module: '@platformatic/db'
    })
    this.connectionStrings = {
      postgres: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
      sqlite: 'sqlite://./db.sqlite',
      mysql: 'mysql://root@127.0.0.1:3306/platformatic',
      mariadb: 'mysql://root@127.0.0.1:3306/platformatic'
    }
  }

  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()
    return {
      ...defaultBaseConfig,
      database: 'sqlite',
      connectionString: null,
      types: true,
      migrations: 'migrations',
      createMigrations: true
    }
  }

  async _getConfigFileContents () {
    const { typescript, isRuntimeContext, envPrefix = '', migrations, plugin, types } = this.config
    const version = this.platformaticVersion
    const connectionStringValue = envPrefix ? `PLT_${envPrefix}_DATABASE_URL` : 'DATABASE_URL'
    const applyMigrationsStringValue = envPrefix ? `PLT_${envPrefix}_APPLY_MIGRATIONS` : 'PLT_APPLY_MIGRATIONS'
    const config = {
      $schema: `https://platformatic.dev/schemas/v${version}/db`,
      db: {
        connectionString: `{${connectionStringValue}}`,
        graphql: true,
        openapi: true,
        schemalock: true
      },
      watch: {
        ignore: ['*.sqlite', '*.sqlite-journal']
      }
    }

    if (!isRuntimeContext) {
      config.server = {
        hostname: '{PLT_SERVER_HOSTNAME}',
        port: '{PORT}',
        logger: {
          level: '{PLT_SERVER_LOGGER_LEVEL}'
        }
      }
    }

    if (migrations) {
      config.migrations = {
        dir: migrations,
        autoApply: `{${applyMigrationsStringValue}}`
      }
    }

    if (plugin === true) {
      config.plugins = {
        paths: [{
          path: './plugins',
          encapsulate: false
        }, {
          path: './routes'
        }]
      }
    }

    if (types === true) {
      config.types = {
        autogenerate: true
      }
    }
    if (typescript === true && config.plugins) {
      config.plugins.typescript = true
    }

    return config
  }

  async _beforePrepare () {
    this.config.connectionString = this.config.connectionString || this.connectionStrings[this.config.database]
    this.config.dependencies = {
      '@platformatic/db': `^${this.platformaticVersion}`
    }

    if (this.config.isRuntimeContext) {
      this.config.env = {
        DATABASE_URL: this.connectionStrings[this.config.database],
        PLT_APPLY_MIGRATIONS: 'true'
      }
      this.config.env = addPrefixToEnv(this.config.env, this.config.envPrefix)
    } else {
      this.config.env = {
        PLT_SERVER_HOSTNAME: this.config.hostname,
        PLT_SERVER_LOGGER_LEVEL: 'info',
        PLT_APPLY_MIGRATIONS: 'true',
        PORT: 3042,
        DATABASE_URL: this.connectionStrings[this.config.database],
        ...this.config.env
      }
    }
  }

  async _afterPrepare () {
    if (this.config.createMigrations) {
      this.createMigrationFiles()
    }

    this.addFile({ path: '', file: 'README.md', contents: await readFile(join(__dirname, 'README.md')) })

    if (this.config.plugin) {
      let jsHelper = { pre: '', config: '', post: '' }
      switch (this.config.database) {
        case 'sqlite':
          jsHelper = jsHelperSqlite
          break
        case 'mysql':
          jsHelper = jsHelperMySQL(this.config.connectionString)
          break
        case 'postgres':
          jsHelper = jsHelperPostgres(this.config.connectionString)
          break
        case 'mariadb':
          jsHelper = jsHelperMySQL(this.config.connectionString)
          break
      }

      if (this.config.createMigrations) {
        if (this.config.typescript) {
          this.addFile({ path: join('test', 'routes'), file: 'movies.test.ts', contents: moviesTestTS })
        } else {
          this.addFile({ path: join('test', 'routes'), file: 'movies.test.js', contents: moviesTestJS })
        }
      }

      // TODO(leorossi): this is unfortunate. We have already generated tests in BaseGenerator
      // next line will override the test files
      generateTests(this.config.typescript, '@platformatic/db', jsHelper).forEach((fileObject) => {
        this.addFile(fileObject)
      })

      if (this.config.isRuntimeContext) {
        // remove .env file and env variables since they are all for the config.server property
        const envFile = this.getFileObject('.env')
        if (envFile) {
          envFile.contents = ''
        }
      }
    }

    const GLOBAL_TYPES_TEMPLATE = `
import { FastifyInstance } from 'fastify'
import { PlatformaticApp, PlatformaticDBConfig, PlatformaticDBMixin, Entities } from '@platformatic/db'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: PlatformaticApp<PlatformaticDBConfig> & PlatformaticDBMixin<Entities>
  }
}
`
    this.addFile({ path: '', file: 'global.d.ts', contents: GLOBAL_TYPES_TEMPLATE })
  }

  createMigrationFiles () {
    this.addFile({ path: 'migrations', file: '001.do.sql', contents: this.getMoviesMigrationDo() })
    this.addFile({ path: 'migrations', file: '001.undo.sql', contents: this.getMoviesMigrationUndo() })
  }

  getMoviesMigrationDo () {
    const key = {
      postgres: 'SERIAL',
      sqlite: 'INTEGER',
      mysql: 'INTEGER UNSIGNED AUTO_INCREMENT',
      mariadb: 'INTEGER UNSIGNED AUTO_INCREMENT'
    }

    return `
  -- Add SQL in this file to create the database tables for your API
  CREATE TABLE IF NOT EXISTS movies (
    id ${key[this.config.database]} PRIMARY KEY,
    title TEXT NOT NULL
  );
  `
  }

  getMoviesMigrationUndo () {
    return '-- Add SQL in this file to drop the database tables\nDROP TABLE movies;'
  }

  setConfigFields (fields) {
    super.setConfigFields(fields)
    this.config.database = this.getDatabaseFromConnectionString()
  }

  getDatabaseFromConnectionString () {
    if (this.config.connectionString) {
      if (this.config.connectionString.indexOf('://') !== -1) {
        const splitted = this.config.connectionString.split('://')
        return splitted[0]
      }
      return null
    }
    return null
  }

  getConfigFieldsDefinitions () {
    return [
      {
        var: 'DATABASE_URL',
        label: 'What is the connection string?',
        default: this.connectionStrings.sqlite,
        type: 'string',
        configValue: 'connectionString'
      },
      {
        var: 'PLT_APPLY_MIGRATIONS',
        label: 'Should migrations be applied automatically on startup?',
        default: true,
        type: 'boolean'
      }
    ]
  }

  async prepareQuestions () {
    await super.prepareQuestions()
    if (!this.config.connectionString) {
      const def = this.getConfigFieldsDefinitions().find((q) => q.var === 'DATABASE_URL')
      this.questions.push({
        type: 'input',
        name: def.configValue,
        message: def.label,
        default: def.default
      })
    }

    this.questions.push({
      type: 'list',
      name: 'createMigrations',
      message: 'Do you want to create default migrations?',
      default: true,
      choices: [{ name: 'yes', value: true }, { name: 'no', value: false }]
    })
  }
}

module.exports = DBGenerator
module.exports.DBGenerator = DBGenerator
module.exports.Generator = DBGenerator
