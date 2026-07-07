import fastify, {
  type FastifyPluginAsync,
} from 'fastify'
import { expect, test } from 'tstyche'
import auth, { errors } from '../../index.js'
import type {
  AddRulesForRoles,
  DBAuthorizationPluginInterface,
  DBAuthorizationPluginOptions,
  SetupDBAuthorizationUserDecorator,
} from '../../index.js'
import { FastifyError } from '@fastify/error'

declare module 'fastify' {
  interface FastifyInstance {
    platformatic: DBAuthorizationPluginInterface
  }
}

test('auth plugin type', () => {
  expect(auth).type.toBe<FastifyPluginAsync<DBAuthorizationPluginOptions>>()
})

const app = fastify()
app.register(auth)
app.register(async (instance) => {
  test('addRulesForRoles decorator type', () => {
    expect(instance.platformatic.addRulesForRoles).type.toBe<AddRulesForRoles>()
  })

  interface User {
    email: string
  }

  instance.platformatic.addRulesForRoles<User>([{
    role: 'role',
    entity: 'entity',
    find: ({ user, where }) => {
      test('find rule user type', () => {
        expect(user).type.toBe<User>()
      })
      return where
    },
  }])

  instance.platformatic.addRulesForRoles<User>([{
    role: 'role',
    entity: 'entity',
    updateMany: true,
  }])

  instance.platformatic.addRulesForRoles<User>([{
    role: 'role',
    entity: 'entity',
    updateMany: {
      checks: { userId: 'X-PLATFORMATIC-USER-ID' },
    },
  }])

  instance.platformatic.addRulesForRoles<User>([{
    role: 'role',
    entity: 'entity',
    insert: true,
  }])

  instance.platformatic.addRulesForRoles<User>([{
    role: 'role',
    entity: 'entity',
    insert: {
      checks: { userId: 'X-PLATFORMATIC-USER-ID' },
    },
  }])

  instance.get('/test', (request) => {
    test('setupDBAuthorizationUser decorator type', () => {
      expect(request.setupDBAuthorizationUser).type.toBe<SetupDBAuthorizationUserDecorator>()
    })
  })
})

// Errors
type ErrorWithNoParams = () => FastifyError
type ErrorWithOneParam = (param: string) => FastifyError
type ErrorWithTwoParams = (param1: string, param2: string) => FastifyError

test('error factories', () => {
  expect(errors.Unauthorized).type.toBe<ErrorWithNoParams>()
  expect(errors.UnauthorizedField).type.toBe<ErrorWithOneParam>()
  expect(errors.MissingNotNullableError).type.toBe<ErrorWithTwoParams>()
})
