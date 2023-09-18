/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="@platformatic/sql-graphql" />
/// <reference types="@platformatic/sql-openapi" />
import { FastifyInstance } from 'fastify'
import { PlatformaticDB } from './config'
import { PlatformaticApp as _PlatformaticApp } from '@platformatic/service'
import { SQLMapperPluginInterface, Entities as _Entities, EntityHooks as _EntityHooks, Entity as _Entity } from '@platformatic/sql-mapper'
import { SQLEventsPluginInterface } from '@platformatic/sql-events'

export type PlatformaticDBMixin<T extends Entities> =
  SQLMapperPluginInterface<T> &
  SQLEventsPluginInterface

export type Entities = _Entities
export type EntityHooks<T> = _EntityHooks<T>
export type Entity<T> = _Entity<T>
export type PlatformaticDBConfig = PlatformaticDB
export type PlatformaticApp<T> = _PlatformaticApp<T>

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

declare module 'fastify' {
  interface FastifyInstance {
    restart: () => Promise<void>
  }
}
