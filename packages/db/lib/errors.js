import createError from '@fastify/error'

export const ERROR_PREFIX = 'PLT_DB'

export const MigrateMissingMigrationsError = createError(
  `${ERROR_PREFIX}_MIGRATE_ERROR`,
  'Missing "migrations" section in config file'
)
export const UnknownDatabaseError = createError(`${ERROR_PREFIX}_UNKNOWN_DATABASE_ERROR`, 'Unknown database')
export const MigrateMissingMigrationsDirError = createError(
  `${ERROR_PREFIX}_MIGRATE_ERROR`,
  'Migrations directory %s does not exist'
)
export const MissingSeedFileError = createError(`${ERROR_PREFIX}_MISSING_SEED_FILE_ERROR`, 'Missing seed file')
export const MigrationsToApplyError = createError(
  `${ERROR_PREFIX}_MIGRATIONS_TO_APPLY_ERROR`,
  'You have migrations to apply.'
)
