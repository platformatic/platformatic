import type { SQL, SQLQuery } from '@databases/sql'
import type { FastifyError } from '@fastify/error'
import { fastify, type FastifyInstance, type FastifyReply } from 'fastify'
import { expect, test } from 'tstyche'
import {
  connect,
  createConnectionPool,
  type Database,
  type DBEntityField,
  type Entities,
  type Entity,
  type EntityHooks,
  errors,
  type PlatformaticContext,
  plugin,
  type SQLMapperPluginInterface,
  utils,
  type WhereClause
} from '../../index.js'

const log = {
  trace () {},
  error () {},
  warn () {}
}

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: SQLMapperPluginInterface<Entities>
  }
}

test('sql mapper plugin types', async () => {
  const pluginOptions = await connect<Entities>({ connectionString: '', log })

  expect(pluginOptions.db).type.toBe<Database>()
  expect(pluginOptions.sql).type.toBe<SQL>()
  expect(pluginOptions.entities).type.toBe<{ [entityName: string]: Entity }>()

  expect(pluginOptions.cleanUpAllEntities()).type.toBe<Promise<void>>()

  expect(
    await connect<Entities>({
      connectionString: '',
      poolSize: 2,
      queueTimeoutMilliseconds: 42,
      idleTimeoutMilliseconds: 42,
      acquireLockTimeoutMilliseconds: 42
    })
  ).type.toBe<SQLMapperPluginInterface<Entities>>()

  expect(
    await connect<Entities>({
      connectionString: '',
      cache: false
    })
  ).type.toBe<SQLMapperPluginInterface<Entities>>()

  expect(
    await connect<Entities>({
      connectionString: '',
      cache: true
    })
  ).type.toBe<SQLMapperPluginInterface<Entities>>()

  expect(
    await connect<Entities>({
      connectionString: '',
      cache: {
        ttl: 1000,
        stale: 10
      }
    })
  ).type.toBe<SQLMapperPluginInterface<Entities>>()

  interface EntityFields {
    id: number
    name: string
  }

  const ctx: PlatformaticContext = { app: fastify(), reply: {} as FastifyReply }

  const entity = pluginOptions.entities.entityName as Entity<EntityFields>
  expect(entity.name).type.toBe<string>()
  expect(entity.singularName).type.toBe<string>()
  expect(entity.pluralName).type.toBe<string>()
  expect(entity.primaryKey).type.toBe<string>()
  expect(entity.primaryKeys).type.toBe<Set<string>>()
  expect(entity.table).type.toBe<string>()
  expect(entity.relations).type.toBe<any[]>()
  expect(entity.fields).type.toBe<{ [columnName: string]: DBEntityField }>()
  expect(entity.camelCasedFields).type.toBe<{ [columnName: string]: DBEntityField }>()
  expect(entity.fixInput).type.toBe<(input: { [columnName: string]: any }) => { [columnName: string]: any }>()
  expect(entity.fixOutput).type.toBe<(input: { [columnName: string]: any }) => { [columnName: string]: any }>()
  expect(await entity.find()).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.insert({ inputs: [{ id: 1, name: 'test' }] })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.save({ input: { id: 1, name: 'test' } })).type.toBe<Partial<EntityFields>>()
  expect(await entity.delete()).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.count()).type.toBe<number>()
  expect(await entity.find({ tx: pluginOptions.db })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.find({ ctx })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.insert({ inputs: [{ id: 1, name: 'test' }], tx: pluginOptions.db })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.save({ input: { id: 1, name: 'test' }, tx: pluginOptions.db })).type.toBe<Partial<EntityFields>>()
  expect(await entity.save({ input: { id: 1, name: 'test' }, ctx })).type.toBe<Partial<EntityFields>>()
  expect(await entity.delete({ tx: pluginOptions.db })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.delete({ ctx })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.count({ tx: pluginOptions.db })).type.toBe<number>()
  expect(await entity.count({ ctx })).type.toBe<number>()
  expect(
    await entity.updateMany({ where: { id: { eq: '1' } }, input: { id: 1, name: 'test' } })
  ).type.toBe<Partial<EntityFields>[]>()
  expect(
    await entity.updateMany({ where: { id: { eq: '1' } }, input: { id: 1, name: 'test' }, ctx })
  ).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.updateMany({ where: { id: { eq: '1' } }, input: { name: 'test' } })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.find({ where: { id: { eq: null } } })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.find({ where: { id: { neq: null } } })).type.toBe<Partial<EntityFields>[]>()

  const whereCondition: WhereClause = {
    eq: { eq: '' },
    eqNumber: { eq: 1 },
    eqBoolean: { eq: true },
    neq: { neq: '' },
    neqNumber: { neq: 1 },
    neqBoolean: { neq: true },
    gt: { gt: '' },
    gte: { gte: '' },
    lt: { lt: '' },
    lte: { lte: '' },
    in: { in: [] },
    nin: { nin: [] },
    like: { like: '' },
    ilike: { ilike: '' },
    all: { all: '' },
    any: { any: '' },
    contains: { contains: [] },
    contained: { contained: [] },
    overlaps: { overlaps: [] },
    or: [{ field: { eq: '' } }, { field: { eq: null } }]
  }

  expect(await entity.find({ where: whereCondition })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.delete({ where: whereCondition })).type.toBe<Partial<EntityFields>[]>()
  expect(await entity.count({ where: whereCondition })).type.toBe<number>()
  expect(await entity.updateMany({ where: whereCondition, input: { id: 1, name: 'test' } })).type.toBe<Partial<EntityFields>[]>()

  const entityHooks: EntityHooks = {
    async find (
      originalFind: typeof entity.find,
      ...options: Parameters<typeof entity.find>
    ): ReturnType<typeof entity.find> {
      return []
    },
    async insert (
      originalInsert: typeof entity.insert,
      ...options: Parameters<typeof entity.insert>
    ): ReturnType<typeof entity.insert> {
      return []
    },
    async save (
      originalSave: typeof entity.save,
      ...options: Parameters<typeof entity.save>
    ): ReturnType<typeof entity.save> {
      return {}
    },
    async delete (
      originalDelete: typeof entity.delete,
      ...options: Parameters<typeof entity.delete>
    ): ReturnType<typeof entity.delete> {
      return []
    },
    async count (
      originalCount: typeof entity.count,
      ...options: Parameters<typeof entity.count>
    ): ReturnType<typeof entity.count> {
      return 0
    },
    async updateMany (
      originalUpdateMany: typeof entity.updateMany,
      ...options: Parameters<typeof entity.updateMany>
    ): ReturnType<typeof entity.updateMany> {
      return []
    }
  }

  expect(entityHooks).type.toBe<EntityHooks>()
  expect(await connect<Entities>({ connectionString: '', log })).type.toBe<SQLMapperPluginInterface<Entities>>()
  expect(
    await connect<Entities>({ connectionString: '', autoTimestamp: true, log })
  ).type.toBe<SQLMapperPluginInterface<Entities>>()
  expect(await connect<Entities>({ connectionString: '', hooks: {}, log })).type.toBe<SQLMapperPluginInterface<Entities>>()
  expect(
    await connect<Entities>({
      connectionString: '',
      hooks: {
        Page: entityHooks
      },
      log
    })
  ).type.toBe<SQLMapperPluginInterface<Entities>>()
  expect(await connect<Entities>({ connectionString: '', ignore: {}, log })).type.toBe<SQLMapperPluginInterface<Entities>>()
  expect(
    await connect<Entities>({
      connectionString: '',
      log,
      onDatabaseLoad (db: Database, sql: SQL) {
        expect(db.query).type.toBe<(query: SQLQuery) => Promise<any[]>>()
        expect(db.dispose).type.toBe<() => Promise<void>>()
        expect(db.tx<EntityFields>).type.toBe<(fn: (tx: Database) => Promise<EntityFields>, options?: any) => Promise<EntityFields>>()
        expect(pluginOptions.db.isMySql).type.toBe<boolean | undefined>()
        expect(pluginOptions.db.isMariaDB).type.toBe<boolean | undefined>()
        expect(pluginOptions.db.isSQLite).type.toBe<boolean | undefined>()
        expect(pluginOptions.db.isPg).type.toBe<boolean | undefined>()
      }
    })
  ).type.toBe<SQLMapperPluginInterface<Entities>>()

  const instance: FastifyInstance = fastify()
  instance.register(plugin, { connectionString: '', autoTimestamp: true })
  instance.register(instance => {
    expect(instance.platformatic).type.toBe<SQLMapperPluginInterface<Entities>>()

    instance.platformatic.addEntityHooks<EntityFields>('something', {
      async find (originalFind, options) {
        expect(await originalFind()).type.toBe<Partial<EntityFields>[]>()
        expect(options).type.toBe<Parameters<typeof entity.find>[0]>()

        return [
          {
            id: 42
          }
        ]
      }
    })

    instance.get('/', async (request, reply) => {
      const ctx = request.platformaticContext
      expect(ctx.app).type.toBe<FastifyInstance>()
      expect(ctx.reply).type.toBe<FastifyReply>()
      await instance.platformatic.cleanUpAllEntities()
    })
  })

  expect(utils.toSingular).type.toBe<(str: string) => string>()
  expect(createConnectionPool({ connectionString: '', log })).type.toBe<Promise<{ db: Database, sql: SQL }>>()
})

test('sql mapper errors types', () => {
  type ErrorWithNoParams = () => FastifyError
  type ErrorWithOneParam = (param: string) => FastifyError
  type ErrorWithOneAnyParam = (param: any) => FastifyError
  type ErrorWithTwoParams = (param1: string, param2: string) => FastifyError

  expect(errors.CannotFindEntityError).type.toBe<ErrorWithOneParam>()
  expect(errors.SpecifyProtocolError).type.toBe<ErrorWithNoParams>()
  expect(errors.ConnectionStringRequiredError).type.toBe<ErrorWithNoParams>()
  expect(errors.TableMustBeAStringError).type.toBe<ErrorWithOneAnyParam>()
  expect(errors.UnknownFieldError).type.toBe<ErrorWithOneParam>()
  expect(errors.InputNotProvidedError).type.toBe<ErrorWithNoParams>()
  expect(errors.UnsupportedWhereClauseError).type.toBe<ErrorWithOneParam>()
  expect(errors.UnsupportedOperatorForArrayFieldError).type.toBe<ErrorWithNoParams>()
  expect(errors.UnsupportedOperatorForNonArrayFieldError).type.toBe<ErrorWithNoParams>()
  expect(errors.ParamNotAllowedError).type.toBe<ErrorWithOneParam>()
  expect(errors.InvalidPrimaryKeyTypeError).type.toBe<ErrorWithTwoParams>()
  expect(errors.ParamLimitNotAllowedError).type.toBe<ErrorWithTwoParams>()
  expect(errors.ParamLimitMustBeNotNegativeError).type.toBe<ErrorWithOneParam>()
  expect(errors.MissingValueForPrimaryKeyError).type.toBe<ErrorWithOneParam>()
  expect(errors.SQLiteOnlySupportsAutoIncrementOnOneColumnError).type.toBe<ErrorWithNoParams>()
})
