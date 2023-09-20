import { expectType } from 'tsd'
import { SQL, SQLQuery } from '@databases/sql'
import { fastify, FastifyInstance, FastifyReply } from 'fastify'
import { FastifyError } from '@fastify/error'
import {
  connect,
  plugin,
  utils,
  Entity,
  DBEntityField,
  Database,
  SQLMapperPluginInterface,
  EntityHooks,
  createConnectionPool,
  Entities,
  errors
} from '../../mapper'

const log = {
  trace() { },
  error() { },
  warn() { }
}

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: SQLMapperPluginInterface<Entities>
  }
}

const pluginOptions: SQLMapperPluginInterface<Entities> = await connect<Entities>({ connectionString: '', log })
expectType<Database>(pluginOptions.db)
expectType<SQL>(pluginOptions.sql)
expectType<{ [entityName: string]: Entity }>(pluginOptions.entities)

expectType<Promise<void>>(pluginOptions.cleanUpAllEntities())

interface EntityFields {
  id: number,
  name: string,
}

const entity: Entity<EntityFields> = pluginOptions.entities.entityName
expectType<string>(entity.name)
expectType<string>(entity.singularName)
expectType<string>(entity.pluralName)
expectType<string>(entity.primaryKey)
expectType<string>(entity.table)
expectType<any[]>(entity.relations)
expectType<{ [columnName: string]: DBEntityField }>(entity.fields)
expectType<{ [columnName: string]: DBEntityField }>(entity.camelCasedFields)
expectType<(input: { [columnName: string]: any }) => { [columnName: string]: any }>(entity.fixInput)
expectType<(input: { [columnName: string]: any }) => { [columnName: string]: any }>(entity.fixOutput)
expectType<Partial<EntityFields>[]>(await entity.find())
expectType<Partial<EntityFields>[]>(await entity.insert({ inputs: [{ id: 1, name: 'test' }] }))
expectType<Partial<EntityFields>>(await entity.save({ input: { id: 1, name: 'test' } }))
expectType<Partial<EntityFields>[]>(await entity.delete())
expectType<number>(await entity.count())

const entityHooks: EntityHooks = {
  async find(originalFind: typeof entity.find, ...options: Parameters<typeof entity.find>): ReturnType<typeof entity.find> { return [] },
  async insert(originalInsert: typeof entity.insert, ...options: Parameters<typeof entity.insert>): ReturnType<typeof entity.insert> { return [] },
  async save(originalSave: typeof entity.save, ...options: Parameters<typeof entity.save>): ReturnType<typeof entity.save> { return {} },
  async delete(originalDelete: typeof entity.delete, ...options: Parameters<typeof entity.delete>): ReturnType<typeof entity.delete> { return [] },
  async count(originalCount: typeof entity.count, ...options: Parameters<typeof entity.count>): ReturnType<typeof entity.count> { return 0 },
}
expectType<EntityHooks>(entityHooks)
expectType<SQLMapperPluginInterface<Entities>>(await connect<Entities>({ connectionString: '', log }))
expectType<SQLMapperPluginInterface<Entities>>(await connect<Entities>({ connectionString: '', autoTimestamp: true, log }))
expectType<SQLMapperPluginInterface<Entities>>(await connect<Entities>({ connectionString: '', hooks: {}, log }))
expectType<SQLMapperPluginInterface<Entities>>(await connect<Entities>({
  connectionString: '', hooks: {
    Page: entityHooks
  },
  log
}))
expectType<SQLMapperPluginInterface<Entities>>(await connect<Entities>({ connectionString: '', ignore: {}, log }))
expectType<SQLMapperPluginInterface<Entities>>(await connect<Entities>({
  connectionString: '', log, onDatabaseLoad(db: Database, sql: SQL) {
    expectType<(query: SQLQuery) => Promise<any[]>>(db.query)
    expectType<() => Promise<void>>(db.dispose)
    expectType<boolean | undefined>(pluginOptions.db.isMySql)
    expectType<boolean | undefined>(pluginOptions.db.isMariaDB)
    expectType<boolean | undefined>(pluginOptions.db.isSQLite)
    expectType<boolean | undefined>(pluginOptions.db.isPg)

  }
}))

const instance: FastifyInstance = fastify()
instance.register(plugin, { connectionString: '', autoTimestamp: true })
instance.register((instance) => {
  expectType<SQLMapperPluginInterface<Entities>>(instance.platformatic)

  instance.platformatic.addEntityHooks<EntityFields>('something', {
    async find(originalFind, options) {
      expectType<Partial<EntityFields>[]>(await originalFind())
      expectType<Parameters<typeof entity.find>[0]>(options)

      return [{
        id: 42
      }]
    }
  })

  instance.get('/', async (request, reply) => {
    const ctx = request.platformaticContext
    expectType<FastifyInstance>(ctx.app)
    expectType<FastifyReply>(ctx.reply)
    await instance.platformatic.cleanUpAllEntities()
  })
})

expectType<(str: string) => string>(utils.toSingular)

expectType<Promise<{ db: Database, sql: SQL }>>(createConnectionPool({ connectionString: '', log }))

// Errors
type ErrorWithNoParams = () => FastifyError
type ErrorWithOneParam = (param: string) => FastifyError
type ErrorWithOneAnyParam = (param: any) => FastifyError
type ErrorWithTwoParams = (param1: string, param2: string) => FastifyError

expectType<ErrorWithOneParam>(errors.CannotFindEntityError)
expectType<ErrorWithNoParams>(errors.SpecifyProtocolError)
expectType<ErrorWithNoParams>(errors.ConnectionStringRequiredError)
expectType<ErrorWithOneAnyParam>(errors.TableMustBeAStringError)
expectType<ErrorWithOneParam>(errors.UnknownFieldError)
expectType<ErrorWithNoParams>(errors.InputNotProvidedError)
expectType<ErrorWithOneParam>(errors.UnsupportedWhereClauseError)
expectType<ErrorWithNoParams>(errors.UnsupportedOperatorForArrayFieldError)
expectType<ErrorWithNoParams>(errors.UnsupportedOperatorForNonArrayFieldError)
expectType<ErrorWithOneParam>(errors.ParamNotAllowedError)
expectType<ErrorWithTwoParams>(errors.InvalidPrimaryKeyTypeError)
expectType<ErrorWithTwoParams>(errors.ParamLimitNotAllowedError)
expectType<ErrorWithOneParam>(errors.ParamLimitMustBeNotNegativeError)
expectType<ErrorWithOneParam>(errors.MissingValueForPrimaryKeyError)
expectType<ErrorWithNoParams>(errors.SQLiteOnlySupportsAutoIncrementOnOneColumnError)

