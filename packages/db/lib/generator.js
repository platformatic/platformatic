import { Generator as ServiceGenerator } from '@platformatic/service'
import { join } from 'node:path'
import {
  ENVIRONMENT_TEMPLATE,
  jsHelperMySQL,
  jsHelperPostgres,
  jsHelperSqlite,
  moviesTestJS,
  moviesTestTS,
  README
} from './templates.js'

export class Generator extends ServiceGenerator {
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

  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()

    return {
      ...defaultBaseConfig,
      database: 'sqlite',
      connectionString: null,
      plugin: true,
      tests: true,
      types: true,
      migrations: 'migrations',
      createMigrations: true
    }
  }

  async prepareQuestions () {
    if (!this.config.connectionString) {
      const def = this.getConfigFieldsDefinitions().find(q => q.var === 'DATABASE_URL')
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
      choices: [
        { name: 'yes', value: true },
        { name: 'no', value: false }
      ]
    })

    await super.prepareQuestions()
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

  async _beforePrepare () {
    if (this.config.isUpdating) {
      return
    }

    await super._beforePrepare()

    this.config.connectionString = this.config.connectionString || this.connectionStrings[this.config.database]
    this.config.dependencies = {
      '@platformatic/db': `^${this.platformaticVersion}`
    }

    if (!this.config.isRuntimeContext) {
      this.addEnvVars(
        {
          PLT_SERVER_HOSTNAME: this.config.hostname,
          PLT_SERVER_LOGGER_LEVEL: 'info',
          PORT: 3042
        },
        { overwrite: false, default: true }
      )
    }

    this.addEnvVars(
      {
        DATABASE_URL: this.connectionStrings[this.config.database],
        PLT_APPLY_MIGRATIONS: 'true'
      },
      { overwrite: false, default: true }
    )
  }

  async _afterPrepare () {
    if (this.config.isUpdating) {
      return
    }

    if (this.config.createMigrations) {
      this.addFile({ path: 'migrations', file: '001.do.sql', contents: this.getMoviesMigrationDo() })
      this.addFile({ path: 'migrations', file: '001.undo.sql', contents: this.getMoviesMigrationUndo() })
    }

    this.addFile({ path: '', file: 'README.md', contents: README })

    if (this.config.plugin) {
      switch (this.config.database) {
        case 'sqlite':
          this.testHelperCustomizations = jsHelperSqlite
          break
        case 'mysql':
          this.testHelperCustomizations = jsHelperMySQL(this.config.connectionString)
          break
        case 'postgres':
          this.testHelperCustomizations = jsHelperPostgres(this.config.connectionString)
          break
        case 'mariadb':
          this.testHelperCustomizations = jsHelperMySQL(this.config.connectionString)
          break
      }

      if (this.config.createMigrations) {
        if (this.config.typescript) {
          this.addFile({ path: join('test', 'routes'), file: 'movies.test.ts', contents: moviesTestTS })
        } else {
          this.addFile({ path: join('test', 'routes'), file: 'movies.test.js', contents: moviesTestJS })
        }
      }
    }

    super._afterPrepare()

    this.addFile({ path: '', file: 'plt-env.d.ts', contents: ENVIRONMENT_TEMPLATE })
  }

  async _getConfigFileContents () {
    const config = await super._getConfigFileContents()
    delete config.application
    config.$schema = `https://schemas.platformatic.dev/@platformatic/db/${this.platformaticVersion}.json`

    config.db = {
      connectionString: `{${this.getEnvVarName('DATABASE_URL')}}`,
      graphql: true,
      openapi: true,
      schemalock: true
    }

    config.watch = {
      ignore: ['*.sqlite', '*.sqlite-journal']
    }

    if (this.config.migrations) {
      config.migrations = {
        dir: this.config.migrations,
        autoApply: `{${this.getEnvVarName('PLT_APPLY_MIGRATIONS')}}`
      }

      this.addFile({ path: 'migrations', file: '.gitkeep', contents: '' })
    }

    if (this.config.types === true) {
      config.types = {
        autogenerate: true
      }
    }

    return config
  }
}
