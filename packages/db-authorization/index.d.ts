import {
  type PlatformaticContext,
  type WhereCondition
} from '@platformatic/sql-mapper'
import { type FastifyPluginAsync } from 'fastify'
import { type FastifyUserPluginOptions } from 'fastify-user'

export type OperationFunction = (args: {
  user: any,
  ctx: PlatformaticContext,
  where: WhereCondition
}) => WhereCondition

export interface OperationChecks {
  checks: Record<string, any> | WhereCondition
}

export type Operation = boolean | OperationFunction | OperationChecks

export type DefaultsFunction = (args: {
  user: any,
  ctx: PlatformaticContext,
  input: Object[]
}) => any
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

export type SetupDBAuthorizationUserDecorator = () => Promise<void>
export type AddRulesForRoles = (rules: Iterable<AuthorizationRule>) => void

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
