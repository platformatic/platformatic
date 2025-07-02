/// <reference types="@platformatic/sql-graphql" />
/// <reference types="@platformatic/sql-openapi" />

import type { BaseOptions, BaseStackable } from '@platformatic/basic'
import type { ConfigManagerConfig } from '@platformatic/config'
import ConfigManager from '@platformatic/config'
import { DBAuthorizationPluginInterface } from '@platformatic/db-authorization'
import { BaseGenerator } from '@platformatic/generators'
import { ServiceContext } from '@platformatic/service'
import { SQLEventsPluginInterface } from '@platformatic/sql-events'
import { Entities, SQLMapperPluginInterface } from '@platformatic/sql-mapper'
import type { JSONSchemaType } from 'ajv'
import { FastifyInstance, type FastifyError } from 'fastify'
import { PlatformaticDB as PlatformaticDatabaseConfig } from './config'

export function platformaticDatabase (app: FastifyInstance, stackable: BaseStackable): Promise<void>

export { PlatformaticApplication } from '@platformatic/service'
export { createConnectionPool, Entities, Entity, EntityHooks } from '@platformatic/sql-mapper'
export { PlatformaticDB as PlatformaticDatabaseConfig } from './config'

export type PlatformaticDatabaseMixin<T extends Entities> = SQLMapperPluginInterface<T> &
  SQLEventsPluginInterface &
  DBAuthorizationPluginInterface

export class Generator extends BaseGenerator.BaseGenerator {}

export class DatabaseStackable extends BaseStackable<PlatformaticDatabaseConfig, BaseOptions<ServiceContext>> {
  constructor (opts: BaseOptions, root: string, configManager: ConfigManager<PlatformaticDatabaseConfig>)
  getApplication (): FastifyInstance
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

export const configType: 'service'

export const configManagerConfig: ConfigManagerConfig<PlatformaticDatabaseConfig>

export const version: string
