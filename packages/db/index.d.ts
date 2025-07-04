import type { BaseOptions, BaseStackable } from '@platformatic/basic'
import type { ConfigManager, ConfigManagerConfig } from '@platformatic/config'
import { DBAuthorizationPluginInterface } from '@platformatic/db-authorization'
import { BaseGenerator } from '@platformatic/generators'
import { PlatformaticApplication, ServiceStackable } from '@platformatic/service'
import { SQLEventsPluginInterface } from '@platformatic/sql-events'
import { Entities, SQLMapperPluginInterface } from '@platformatic/sql-mapper'
import type { JSONSchemaType } from 'ajv'
import { FastifyInstance, type FastifyError } from 'fastify'
import { PlatformaticDatabaseConfig } from './config'

export function platformaticDatabase (app: FastifyInstance, stackable: BaseStackable): Promise<void>

export { PlatformaticApplication } from '@platformatic/service'
export { createConnectionPool, Entities, Entity, EntityHooks } from '@platformatic/sql-mapper'
export { PlatformaticDatabaseConfig } from './config'

export type PlatformaticDatabaseMixin<T extends Entities> = SQLMapperPluginInterface<T> &
  SQLEventsPluginInterface &
  DBAuthorizationPluginInterface

export class Generator extends BaseGenerator.BaseGenerator {}

export type DatabaseStackable = ServiceStackable<PlatformaticDatabaseConfig>

export type ServerInstance<T = {}> = FastifyInstance & {
  platformatic: PlatformaticApplication<PlatformaticDatabaseConfig> & PlatformaticDatabaseMixin<Entities> & T
}

export function transformConfig (this: ConfigManager): Promise<void>

export function buildStackable (
  root: string,
  source: string | PlatformaticDatabaseConfig,
  opts: BaseOptions
): Promise<DatabaseStackable>

export function create (
  root: string,
  source?: string | PlatformaticDatabaseConfig,
  opts?: object,
  context?: object
): Promise<DatabaseStackable>

/**
 * All the errors thrown by the plugin.
 */
export declare const errors: {
  MigrateMissingMigrationsError: () => FastifyError
  UnknownDatabaseError: () => FastifyError
  MigrateMissingMigrationsDirError: (dir: string) => FastifyError
  MissingSeedFileError: () => FastifyError
  MigrationsToApplyError: () => FastifyError
}

export const schema: JSONSchemaType<PlatformaticDatabaseConfig>

export const configType: 'db'

export const configManagerConfig: ConfigManagerConfig<PlatformaticDatabaseConfig>

export const version: string
