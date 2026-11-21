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
export const ApplyMigrationError = createError(
  `${ERROR_PREFIX}_MIGRATE_ERROR`,
  'Unable to apply migration %s: %s'
)
export const OutOfOrderMigrationsError = createError(
  `${ERROR_PREFIX}_OUT_OF_ORDER_MIGRATIONS_ERROR`,
  'Found migrations below the current database version %s that are not recorded as applied: %s. See the "migrations.outOfOrder" option.'
)
export const MissingSeedFileError = createError(`${ERROR_PREFIX}_MISSING_SEED_FILE_ERROR`, 'Missing seed file')
export const MigrationsToApplyError = createError(
  `${ERROR_PREFIX}_MIGRATIONS_TO_APPLY_ERROR`,
  'You have migrations to apply.'
)
export const InvalidSchemaLockError = createError(
  `${ERROR_PREFIX}_INVALID_SCHEMA_LOCK_ERROR`,
  'Invalid schema lock format.'
)
