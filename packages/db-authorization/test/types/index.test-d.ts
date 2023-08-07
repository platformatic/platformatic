import fastify, {
  type FastifyPluginAsync
} from 'fastify'
import { expectType } from 'tsd'
import auth, {
  DBAuthorizationPluginOptions,
  AddRulesForRoles,
  SetupDBAuthorizationUserDecorator
} from '../..'

expectType<FastifyPluginAsync<DBAuthorizationPluginOptions>>(auth)

const app = fastify()
app.register(auth)
app.register(async (instance) => {
  expectType<AddRulesForRoles>(instance.platformatic.addRulesForRoles)

  instance.get('/test', (request) => {
    expectType<SetupDBAuthorizationUserDecorator>(request.setupDBAuthorizationUser)
  })
})
