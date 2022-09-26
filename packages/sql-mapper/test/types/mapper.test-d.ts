import { expectType } from 'tsd'
import { SQL, SQLQuery } from '@databases/sql'
import { fastify, FastifyInstance } from 'fastify'
import {
  connect,
  plugin,
  utils,
  Entity,
  DBEntityField,
  Database,
  WhereCondition,
  SQLMapperPluginInterface,
  EntityHooks,
} from '../../mapper'

const pluginOptions: SQLMapperPluginInterface = await connect({ connectionString: '' })
expectType<Database>(pluginOptions.db)
expectType<SQL>(pluginOptions.sql)
expectType<(entityName: string, hooks: EntityHooks) => any>(pluginOptions.addEntityHooks)
expectType<{ [entityName: string]: Entity }>(pluginOptions.entities)

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

expectType<SQLMapperPluginInterface>(await connect({ connectionString: '' }))
expectType<SQLMapperPluginInterface>(await connect({ connectionString: '', autoTimestamp: true }))
expectType<SQLMapperPluginInterface>(await connect({ connectionString: '', hooks: {} }))
expectType<SQLMapperPluginInterface>(await connect({ connectionString: '', hooks: {
  Page: {
    async find(options: any): Promise<any[]> { return [] },
    async insert(options: { inputs: any[], fields?: string[] }): Promise<any[]> { return [] },
    async save(options: { input: any, fields?: string[] }): Promise<any> { return {} },
    async delete(options?: { where: WhereCondition, fields: string[] }): Promise<any[]> { return [] },
  }
}}))
expectType<SQLMapperPluginInterface>(await connect({ connectionString: '', ignore: {} }))
expectType<SQLMapperPluginInterface>(await connect({ connectionString: '', onDatabaseLoad(db: Database, sql: SQL) {
  expectType<(query: SQLQuery) => Promise<any[]>>(db.query)
  expectType<() => Promise<void>>(db.dispose)
  expectType<boolean | undefined>(pluginOptions.db.isMySql)
  expectType<boolean | undefined>(pluginOptions.db.isMariaDB)
  expectType<boolean | undefined>(pluginOptions.db.isSQLite)
  expectType<boolean | undefined>(pluginOptions.db.isPg)

}}))

const instance: FastifyInstance = fastify()
instance.register(plugin, { connectionString: '', autoTimestamp: true })
instance.register((instance) => { expectType<SQLMapperPluginInterface>(instance.platformatic) })

expectType<(str: string) => string>(utils.toSingular)
