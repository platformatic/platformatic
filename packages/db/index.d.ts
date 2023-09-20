/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="@platformatic/sql-graphql" />
/// <reference types="@platformatic/sql-openapi" />
import { FastifyInstance } from 'fastify'
import { PlatformaticDB } from './config'
import { SQLMapperPluginInterface, Entities } from '@platformatic/sql-mapper'
import { SQLEventsPluginInterface } from '@platformatic/sql-events'
import { DBAuthorizationPluginInterface } from '@platformatic/db-authorization'

export { Entities, EntityHooks, Entity } from '@platformatic/sql-mapper'
export { PlatformaticApp } from '@platformatic/service'

export type PlatformaticDBMixin<T extends Entities> =
  SQLMapperPluginInterface<T> &
  SQLEventsPluginInterface &
  DBAuthorizationPluginInterface

export type PlatformaticDBConfig = PlatformaticDB

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>
