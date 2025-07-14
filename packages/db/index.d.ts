import { DBAuthorizationPluginInterface } from '@platformatic/db-authorization'
import { BaseGenerator } from '@platformatic/generators'
import { PlatformaticApplication, ServiceStackable } from '@platformatic/service'
import { SQLEventsPluginInterface } from '@platformatic/sql-events'
import { Entities, SQLMapperPluginInterface } from '@platformatic/sql-mapper'
import { JSONSchemaType } from 'ajv'
import { FastifyError, FastifyInstance } from 'fastify'
import { PlatformaticDatabaseConfig } from './config'

export { PlatformaticApplication } from '@platformatic/service'
export { createConnectionPool, Entities, Entity, EntityHooks } from '@platformatic/sql-mapper'
export { PlatformaticDatabaseConfig } from './config'

export type PlatformaticDatabaseMixin<T extends Entities> = SQLMapperPluginInterface<T> &
  SQLEventsPluginInterface &
  DBAuthorizationPluginInterface

export type DatabaseStackable = ServiceStackable<PlatformaticDatabaseConfig>

export type ServerInstance<T = {}> = FastifyInstance & {
  platformatic: PlatformaticApplication<PlatformaticDatabaseConfig> & PlatformaticDatabaseMixin<Entities> & T
}

export declare function transform<T extends object> (config: T): Promise<T>

export function create (
  root: string,
  source?: string | PlatformaticDatabaseConfig,
  context?: object
): Promise<DatabaseStackable>

export declare const skipTelemetryHooks: boolean

export declare function platformaticDatabase (app: FastifyInstance, stackable: DatabaseStackable): Promise<void>

export declare class Generator extends BaseGenerator.BaseGenerator {}

export declare const packageJson: Record<string, unknown>

export declare const schema: JSONSchemaType<PlatformaticDatabaseConfig>

export declare const schemaComponents: {
  db: JSONSchemaType<object>
  sharedAuthorizationRule: JSONSchemaType<object>
  authorization: JSONSchemaType<object>
  migrations: JSONSchemaType<object>
  types: JSONSchemaType<object>
}

export declare const version: string

export declare function MigrateMissingMigrationsError (): FastifyError
export declare function UnknownDatabaseError (): FastifyError
export declare function MigrateMissingMigrationsDirError (dir: string): FastifyError
export declare function MissingSeedFileError (): FastifyError
export declare function MigrationsToApplyError (): FastifyError
