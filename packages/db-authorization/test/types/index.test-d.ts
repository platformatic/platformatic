import fastify, {
  type FastifyPluginAsync
} from 'fastify'
import { expectType } from 'tsd'
import auth, {
  AddRulesForRoles,
  DBAuthorizationPluginOptions,
  SetupDBAuthorizationUserDecorator
} from '../..'

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
