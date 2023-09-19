import { FastifyPluginAsync, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { PlatformaticApp } from '@platformatic/types'
import { SQL, SQLQuery } from '@databases/sql'
import { FastifyError } from '@fastify/error'

interface ILogger {
  trace(): any,
  error(): any,
  warn(): any
}

export interface Database {
  /**
   * An option that is true if a Postgres database is used.
   */
  isPg?: boolean,
  /**
   * An option that is true if a MariaDB database is used.
   */
  isMariaDB?: boolean,
  /**
   * An option that is true if a MySQL database is used.
   */
  isMySql?: boolean,
  /**
   * An option that is true if a SQLite database is used.
   */
  isSQLite?: boolean,
  /**
   * Run an SQL Query and get a promise for an array of results. If your query contains multiple statements, only the results of the final statement are returned.
   */
  query(query: SQLQuery): Promise<any[]>,
  /**
   * Dispose the connection. Once this is called, any subsequent queries will fail.
   */
  dispose(): Promise<void>
}

export interface DBEntityField {
  /**
   * Field type in the database.
   */
  sqlType: string,
  /**
   * Camel cased field name.
   */
  camelcase: string,
  /**
   * An option that is true if field is a primary key.
   */
  primaryKey?: boolean,
  /**
   * An option that is true if field is a foreignKey key.
   */
  foreignKey?: boolean,
  /**
   * An option that is true if field is nullable.
   */
  isNullable: boolean,
  /**
   * An option that is true if auto timestamp enabled for this field.
   */
  autoTimestamp?: boolean
}

export interface WhereCondition {
  [columnName: string]: {
    /**
     * Equal to value.
     */
    eq?: string,
    /**
     * Not equal to value.
     */
    neq?: string,
    /**
     * Greater than value.
     */
    gr?: any,
    /**
     * Greater than or equal to value.
     */
    gte?: any,
    /**
     * Less than value.
     */
    lt?: any,
    /**
     * Less than or equal to value.
     */
    lte?: any,
    /**
     * In values.
     */
    in?: any[],
    /**
     * Not in values.
     */
    nin?: any[]
    /**
     * Like value.
     */
    like?: string
    /**
     * Like ignore-case value.
     */
    ilike?: string,
    /**
     * All subquery
     */
    all?: string,
    /**
     * Any subquery
     */
    any?: string
    /**
     * Contains values
     */
    contains?: any[],
    /**
     * Contained by values
     */
    contained?: any[],
    /**
     * Overlaps with values
     */
    overlaps?: any[]
  }
}

interface Find<EntityFields> {
  (options?: {
    /**
     * SQL where condition.
     */
    where?: WhereCondition,
    /**
     * List of fields to be returned for each object
     */
    fields?: string[],
    /**
     * Entity fields to order by.
     */
    orderBy?: Array<{ field: string, direction: 'asc' | 'desc' }>,
    /**
     * Number of entities to select.
     */
    limit?: number,
    /**
     * Number of entities to skip.
     */
    offset?: number,
    /**
     * If present, the entity partecipates in transaction
    */
    tx?: Database
  }): Promise<Partial<EntityFields>[]>
}

interface Count {
  (options?: {
    /**
     * SQL where condition.
     */
    where?: WhereCondition,
  }): Promise<number>
}

interface Insert<EntityFields> {
  (options: {
    /**
     * Entities to insert.
     */
    inputs: EntityFields[],
    /**
     * List of fields to be returned for each object
     */
    fields?: string[]
  }): Promise<Partial<EntityFields>[]>
}

interface Save<EntityFields> {
  (options: {
    /**
     * Entity to save.
     */
    input: EntityFields,
    /**
     * List of fields to be returned for each object
     */
    fields?: string[]
  }): Promise<Partial<EntityFields>>
}

interface Delete<EntityFields> {
  (options?: {
    /**
     * SQL where condition.
     */
    where: WhereCondition,
    /**
     * List of fields to be returned for each object
     */
    fields: string[]
  }): Promise<Partial<EntityFields>[]>,
}

export interface Entity<EntityFields = any> {
  /**
   * The origin name of the database entity.
   */
  name: string,
  /**
   * The name of the database object in the singular.
   */
  singularName: string,
  /**
   * The plural name of the database entity.
   */
  pluralName: string,
  /**
   * The primary key of the database entity.
   */
  primaryKey: string,
  /**
   * The table of the database entity.
   */
  table: string,
  /**
   * Fields of the database entity.
   */
  fields: { [columnName: string]: DBEntityField },
  /**
   * Camel cased fields of the database entity.
   */
  camelCasedFields: { [columnName: string]: DBEntityField },
  /**
   * Relations with other database entities.
   */
  relations: any[],
  /**
   * Converts entities fields names to database column names.
   */
  fixInput(input: { [columnName: string]: any }): { [columnName: string]: any },
  /**
   * Converts database column names to entities fields names.
   */
  fixOutput(input: { [columnName: string]: any }): { [columnName: string]: any },
  /**
   * Selects matching entities from the database.
   */
  find: Find<EntityFields>,
  /**
   * Inserts entities to the database.
   */
  insert: Insert<EntityFields>,
  /**
   * Saves entity to the database.
   */
  save: Save<EntityFields>,
  /**
   * Deletes entities from the database.
   */
  delete: Delete<EntityFields>,
  /**
   * Count the entities considering the where condition.
   */
  count: Count,
}

type EntityHook<T extends (...args: any) => any> = (original: T, ...options: Parameters<T>) => ReturnType<T>;

export interface EntityHooks<EntityFields = any> {
  find?: EntityHook<Find<EntityFields>>,
  insert?: EntityHook<Insert<EntityFields>>,
  save?: EntityHook<Save<EntityFields>>,
  delete?: EntityHook<Delete<EntityFields>>,
  count?: EntityHook<Count>,
}

interface BasePoolOptions {
  /**
   * Database connection string.
   */
  connectionString: string,

  /**
   * The maximum number of connections to create at once. Default is 10.
   * @default 10
   */
  poolSize?: number
}

export interface CreateConnectionPoolOptions extends BasePoolOptions {
  /**
   * A logger object (like [Pino](https://getpino.io))
   */
  log: ILogger
}

export function createConnectionPool(options: CreateConnectionPoolOptions): Promise<{ db: Database, sql: SQL }>

export interface SQLMapperPluginOptions extends BasePoolOptions {
  /**
   * A logger object (like [Pino](https://getpino.io))
   */
  log?: ILogger,

  /**
   * Set to true to enable auto timestamping for updated_at and inserted_at fields.
   */
  autoTimestamp?: boolean,
  /**
   * Database table to ignore when mapping to entities.
   */
  ignore?: {
    [tableName: string]: {
      [columnName: string]: boolean
    } | boolean
  },
  /**
   * For each entity name (like `Page`) you can customize any of the entity API function. Your custom function will receive the original function as first parameter, and then all the other parameters passed to it.
   */
  hooks?: {
    [entityName: string]: EntityHooks
  },
  /**
   * An async function that is called after the connection is established.
   */
  onDatabaseLoad?(db: Database, sql: SQL): any,
}

export interface Entities {
  [entityName: string]: Entity
}

export interface SQLMapperPluginInterface {
  /**
   * A Database abstraction layer from [@Databases](https://www.atdatabases.org/)
   */
  db: Database,
  /**
   * The SQL builder from [@Databases](https://www.atdatabases.org/)
   */
  sql: SQL,
  /**
   * An object containing a key for each table found in the schema, with basic CRUD operations. See [entity.md](./entity.md) for details.
   */
  entities: Entities,
  /**
   * Adds hooks to the entity.
   */
  addEntityHooks<EntityFields>(entityName: string, hooks: EntityHooks<EntityFields>): any

  /**
   * Clean up all the data in all entities
   */
  cleanUpAllEntities(): Promise<void>
}

// Extend the PlatformaticApp interface,
// Unfortunately we neeed to copy over all the types from SQLMapperPluginInterface
declare module '@platformatic/types' {
  interface PlatformaticApp {
    /**
     * A Database abstraction layer from [@Databases](https://www.atdatabases.org/)
     */
    db: Database,
    /**
     * The SQL builder from [@Databases](https://www.atdatabases.org/)
     */
    sql: SQL,
    /**
     * An object containing a key for each table found in the schema, with basic CRUD operations. See [entity.md](./entity.md) for details.
     */
    entities: Entities,
    /**
     * Adds hooks to the entity.
     */
    addEntityHooks<EntityFields>(entityName: string, hooks: EntityHooks<EntityFields>): any
    /**
     * Clean up all the data in all entities
     */
    cleanUpAllEntities(): Promise<void>
  }
}

export interface PlatformaticContext {
  app: FastifyInstance,
  reply: FastifyReply
}

declare module 'fastify' {
  interface FastifyRequest {
    platformaticContext: PlatformaticContext
  }
}

/**
 * Connects to the database and maps the tables to entities.
 */
export function connect(options: SQLMapperPluginOptions): Promise<SQLMapperPluginInterface>
/**
 * Fastify plugin that connects to the database and maps the tables to entities.
 */
export const plugin: FastifyPluginAsync<SQLMapperPluginOptions>
export default plugin

/**
 * An object that contains utility functions.
 */
export module utils {
  export function toSingular(str: string): string
}

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const CannotFindEntityError: (entityName: string) => FastifyError
  export const SpecifyProtocolError: () => FastifyError
  export const ConnectionStringRequiredError: () => FastifyError
  export const TableMustBeAStringError: (table: any) => FastifyError
  export const UnknownFieldError: (key: string) => FastifyError
  export const InputNotProvidedError: () => FastifyError
  export const UnsupportedWhereClauseError: (where: string) => FastifyError
  export const UnsupportedOperatorForArrayFieldError: () => FastifyError
  export const UnsupportedOperatorForNonArrayFieldError: () => FastifyError
  export const ParamNotAllowedError: (offset: string) => FastifyError
  export const InvalidPrimaryKeyTypeError: (pkType: string, validTypes: string) => FastifyError
  export const ParamLimitNotAllowedError: (limit: string, max: string) => FastifyError
  export const ParamLimitMustBeNotNegativeError: (limit: string) => FastifyError
  export const MissingValueForPrimaryKeyError: (key: string) => FastifyError
  export const SQLiteOnlySupportsAutoIncrementOnOneColumnError: () => FastifyError
}


