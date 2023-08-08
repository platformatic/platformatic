import {
  type PlatformaticContext,
  type WhereCondition
} from '@platformatic/sql-mapper'
import { type FastifyPluginAsync } from 'fastify'
import { type FastifyUserPluginOptions } from 'fastify-user'

export type OperationFunction<T> = (args: {
  user: T,
  ctx: PlatformaticContext,
  where: WhereCondition
}) => WhereCondition

export interface OperationChecks {
  checks: Record<string, any> | WhereCondition
}

export interface OperationFields {
  fields?: string[]
}

export type Operation<T> = boolean | OperationFields & (OperationFunction<T> | OperationChecks)

export type DefaultsFunction<T> = (args: {
  user: T,
  ctx: PlatformaticContext,
  input: Object[]
}) => any
export type Defaults<T> = DefaultsFunction<T> | Record<string, any>

interface AuthorizationRuleBase<T> {
  role: string
  defaults?: Defaults<T>
  find?: Operation<T>
  save?: Operation<T>
  delete?: Operation<T>
}
export interface AuthorizationRuleEntity<T> extends AuthorizationRuleBase<T> {
  entity: string
}
export interface AuthorizationRuleEntities<T> extends AuthorizationRuleBase<T> {
  entities: string[]
}
export type AuthorizationRule<T> = AuthorizationRuleEntity<T> | AuthorizationRuleEntities<T>

export type SetupDBAuthorizationUserDecorator = () => Promise<void>
export type AddRulesForRoles = <T>(rules: Iterable<AuthorizationRule<T>>) => void

export interface DBAuthorizationPluginOptions<T = any> extends FastifyUserPluginOptions {
  adminSecret?: string
  roleKey?: string
  anonymousRole?: string
  rules: Array<AuthorizationRule<T>>
}

declare module '@platformatic/types' {
  interface PlatformaticApp {
    addRulesForRoles: AddRulesForRoles
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    setupDBAuthorizationUser: SetupDBAuthorizationUserDecorator
  }
}

declare const auth: FastifyPluginAsync<DBAuthorizationPluginOptions>

export default auth
