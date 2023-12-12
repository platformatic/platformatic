'use strict'

const createError = require('@fastify/error')

const ERROR_PREFIX = 'PLT_DB'

module.exports = {
  MigrateMissingMigrationsError: createError(`${ERROR_PREFIX}_MIGRATE_ERROR`, 'Missing "migrations" section in config file'),
  UknonwnDatabaseError: createError(`${ERROR_PREFIX}_UNKNOWN_DATABASE_ERROR`, 'Unknown database'),
  MigrateMissingMigrationsDirError: createError(`${ERROR_PREFIX}_MIGRATE_ERROR`, 'Migrations directory %s does not exist'),
  MissingSeedFileError: createError(`${ERROR_PREFIX}_MISSING_SEED_FILE_ERROR`, 'Missing seed file'),
  MigrationsToApplyError: createError(`${ERROR_PREFIX}_MIGRATIONS_TO_APPLY_ERROR`, 'You have migrations to apply. Please run `platformatic db migrations apply` first.')

}
