import { DBAuthorizationPluginInterface } from '@platformatic/db-authorization'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { PlatformaticApplication, ServiceCapability, Generator as ServiceGenerator } from '@platformatic/service'
import { SQLEventsPluginInterface } from '@platformatic/sql-events'
import { Entities, SQLMapperPluginInterface } from '@platformatic/sql-mapper'
import { JSONSchemaType } from 'ajv'
import { FastifyError, FastifyInstance } from 'fastify'
import type { PlatformaticDatabaseConfig } from './config.d.ts'

export { PlatformaticApplication } from '@platformatic/service'
export { createConnectionPool, Entities, Entity, EntityHooks } from '@platformatic/sql-mapper'
export type { PlatformaticDatabaseConfig } from './config.d.ts'

export type PlatformaticDatabaseMixin<T extends Entities> = SQLMapperPluginInterface<T> &
  SQLEventsPluginInterface &
  DBAuthorizationPluginInterface

export type DatabaseCapability = ServiceCapability<PlatformaticDatabaseConfig>

export type ServerInstance<T = {}> = FastifyInstance & {
  platformatic: PlatformaticApplication<PlatformaticDatabaseConfig> & PlatformaticDatabaseMixin<Entities> & T
}

export type DatabaseConfiguration = Configuration<PlatformaticDatabaseConfig>

export declare function transform (config: DatabaseConfiguration): Promise<DatabaseConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticDatabaseConfig,
  source?: string | PlatformaticDatabaseConfig,
  context?: ConfigurationOptions
): Promise<DatabaseConfiguration>

export declare function create (
  root: string,
  source?: string | PlatformaticDatabaseConfig,
  context?: ConfigurationOptions
): Promise<ServiceCapability>

export declare const skipTelemetryHooks: boolean

export declare function platformaticDatabase (app: FastifyInstance, capability: DatabaseCapability): Promise<void>

export declare class Generator extends ServiceGenerator {}

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
