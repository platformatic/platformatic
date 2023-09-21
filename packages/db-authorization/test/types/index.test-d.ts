import fastify, {
  type FastifyPluginAsync
} from 'fastify'
import { expectType } from 'tsd'
import auth, {
  AddRulesForRoles,
  DBAuthorizationPluginInterface,
  DBAuthorizationPluginOptions,
  SetupDBAuthorizationUserDecorator,
  errors
} from '../..'
import { FastifyError } from '@fastify/error'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: DBAuthorizationPluginInterface
  }
}

expectType<FastifyPluginAsync<DBAuthorizationPluginOptions>>(auth)

const app = fastify()
app.register(auth)
app.register(async (instance) => {
  expectType<AddRulesForRoles>(instance.platformatic.addRulesForRoles)

  interface User {
    email: string
  }

  instance.platformatic.addRulesForRoles<User>([{
    role: 'role',
    entity: 'entity',
    find: ({ user, where }) => {
      expectType<User>(user)
      return where
    }
  }])

  instance.get('/test', (request) => {
    expectType<SetupDBAuthorizationUserDecorator>(request.setupDBAuthorizationUser)
  })
})

// Errors
type ErrorWithNoParams = () => FastifyError
type ErrorWithOneParam = (param: string) => FastifyError
type ErrorWithOneAnyParam = (param: any) => FastifyError
type ErrorWithTwoParams = (param1: string, param2: string) => FastifyError

expectType<ErrorWithNoParams>(errors.Unauthorized)
expectType<ErrorWithOneParam>(errors.UnauthorizedField)
expectType<ErrorWithTwoParams>(errors.MissingNotNullableError)
