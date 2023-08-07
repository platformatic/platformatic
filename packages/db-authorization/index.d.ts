import {
  type PlatformaticContext,
  type WhereCondition
} from '@platformatic/sql-mapper'
import { type FastifyPluginAsync } from 'fastify'
import { type FastifyUserPluginOptions } from 'fastify-user'

export type OperationCheckFunction = (args: {
  user: any,
  ctx: PlatformaticContext,
  where: WhereCondition
}) => WhereCondition
export type OperationCheck = boolean | WhereCondition | OperationCheckFunction
export type OperationChecks = Record<string, OperationCheck>
export type Operation = boolean | {
  checks: string | OperationChecks
}

export type DefaultsFunction = (args: {
  user: any,
  ctx: PlatformaticContext,
  input: Object[]
}) => Record<string, any>
export type Defaults = DefaultsFunction | Record<string, any>

interface AuthorizationRuleBase {
  role: string
  defaults?: Defaults
  find?: Operation
  save?: Operation
  delete?: Operation
}
export interface AuthorizationRuleEntity extends AuthorizationRuleBase {
  entity: string
}
export interface AuthorizationRuleEntities extends AuthorizationRuleBase {
  entities: string[]
}
export type AuthorizationRule = AuthorizationRuleEntity | AuthorizationRuleEntities

export type AuthorizationRuleFunction = (args: {
  user: any,
  ctx: PlatformaticContext,
  where: WhereCondition
}) => AuthorizationRule

export type SetupDBAuthorizationUserDecorator = () => Promise<void>
export type AddRulesForRoles = (rules: Iterable<AuthorizationRuleFunction | AuthorizationRule>) => void

export interface DBAuthorizationPluginOptions extends FastifyUserPluginOptions {
  adminSecret?: string
  roleKey?: string
  anonymousRole?: string
  rules: AuthorizationRule[]
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
