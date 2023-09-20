/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="@platformatic/sql-graphql" />
/// <reference types="@platformatic/sql-openapi" />
import { FastifyInstance } from 'fastify'
import { PlatformaticDB } from './config'
import { PlatformaticApp as _PlatformaticApp } from '@platformatic/service'
import { SQLMapperPluginInterface, Entities as _Entities, EntityHooks as _EntityHooks, Entity as _Entity } from '@platformatic/sql-mapper'
import { SQLEventsPluginInterface } from '@platformatic/sql-events'
import { DBAuthorizationPluginInterface } from '@platformatic/db-authorization'
import { Entities } from '@platformatic/sql-mapper'

export { Entities, EntityHooks, Entity } from '@platformatic/sql-mapper'
export { PlatformaticApp } from '@platformatic/service'

export type PlatformaticDBMixin<T extends Entities> =
  SQLMapperPluginInterface<T> &
  SQLEventsPluginInterface &
  DBAuthorizationPluginInterface


export type PlatformaticDBConfig = PlatformaticDB

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>
