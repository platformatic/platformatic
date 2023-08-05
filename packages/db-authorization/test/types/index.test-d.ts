import fastify, {
  type FastifyPluginAsync
} from 'fastify'
import { expectType } from 'tsd'
import auth, {
  type DBAuthorizationPluginInterface,
  type DBAuthorizationPluginOptions
} from '../..'

expectType<FastifyPluginAsync<DBAuthorizationPluginOptions>>(auth)

const app = fastify()
app.register(auth)
app.register(async (instance) => {
  expectType<DBAuthorizationPluginInterface>(instance.platformatic)
})
