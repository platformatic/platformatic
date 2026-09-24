import core from '@platformatic/db-core'
import fastify from 'fastify'
import { deepEqual, equal } from 'node:assert'
import { test } from 'node:test'
import auth from '../index.js'
import { clear, connInfo, createBasicPages } from './helper.js'

async function setup (t, saveDispatch) {
  const app = fastify()
  const state = { defaultsCalls: 0, run: null }

  app.register(core, {
    ...connInfo,
    saveDispatch,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })

  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [
      {
        role: 'user',
        entity: 'page',
        find: {
          checks: {
            userId: 'X-PLATFORMATIC-USER-ID'
          }
        },
        save: {
          checks: {
            userId: 'X-PLATFORMATIC-USER-ID'
          }
        },
        defaults: {
          userId: async ({ user }) => {
            state.defaultsCalls++
            return user['X-PLATFORMATIC-USER-ID']
          }
        }
      }
    ]
  })

  app.post('/run', async (_request, reply) => {
    return state.run(app.platformatic.entities.page, { reply })
  })

  t.after(() => app.close())
  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  async function run (fn) {
    state.run = fn
    state.defaultsCalls = 0
    return app.inject({
      method: 'POST',
      url: '/run',
      headers: { Authorization: `Bearer ${token}` }
    })
  }

  return { app, state, run, page: app.platformatic.entities.page }
}

for (const saveDispatch of [false, true]) {
  const mode = `saveDispatch: ${saveDispatch}`

  test(`${mode} - save with a PK is authorized with rule.save and applies defaults once`, async t => {
    const { page, run, state } = await setup(t, saveDispatch)
    const [own] = await page.insert({ inputs: [{ title: 'Mine', userId: 42 }] })

    const res = await run((entity, ctx) => entity.save({ input: { id: own.id, title: 'Updated' }, ctx }))
    equal(res.statusCode, 200, res.body)
    deepEqual(res.json(), { id: own.id, title: 'Updated', userId: 42 })
    equal(state.defaultsCalls, 1)
  })

  test(`${mode} - save create applies defaults once`, async t => {
    const { run, state } = await setup(t, saveDispatch)

    const res = await run((entity, ctx) => entity.save({ input: { title: 'New' }, ctx }))
    equal(res.statusCode, 200, res.body)
    equal(res.json().title, 'New')
    equal(res.json().userId, 42)
    equal(state.defaultsCalls, 1)
  })

  test(`${mode} - save with a PK for a row owned by someone else is 403`, async t => {
    const { page, run } = await setup(t, saveDispatch)
    const [other] = await page.insert({ inputs: [{ title: 'Theirs', userId: 99 }] })

    const res = await run((entity, ctx) => entity.save({ input: { id: other.id, title: 'Stolen' }, ctx }))
    equal(res.statusCode, 403, res.body)
    const [row] = await page.find({ where: { id: { eq: other.id } } })
    equal(row.title, 'Theirs')
  })

  test(`${mode} - save with a PK for a missing row is 403`, async t => {
    const { page, run } = await setup(t, saveDispatch)

    const res = await run((entity, ctx) => entity.save({ input: { id: 1000, title: 'Ghost' }, ctx }))
    equal(res.statusCode, 403, res.body)
    deepEqual(await page.find({}), [])
  })

  test(`${mode} - direct update with an unauthorized ctx is 403`, async t => {
    const { page, run } = await setup(t, saveDispatch)
    const [other] = await page.insert({ inputs: [{ title: 'Theirs', userId: 99 }] })

    const res = await run((entity, ctx) => entity.update({ input: { id: other.id, title: 'Stolen' }, ctx }))
    equal(res.statusCode, 403, res.body)
    const [row] = await page.find({ where: { id: { eq: other.id } } })
    equal(row.title, 'Theirs')
  })

  test(`${mode} - direct update with an authorized ctx`, async t => {
    const { page, run, state } = await setup(t, saveDispatch)
    const [own] = await page.insert({ inputs: [{ title: 'Mine', userId: 42 }] })

    const res = await run((entity, ctx) => entity.update({ input: { id: own.id, title: 'Updated' }, ctx }))
    equal(res.statusCode, 200, res.body)
    deepEqual(res.json(), { id: own.id, title: 'Updated', userId: 42 })
    equal(state.defaultsCalls, 1)
  })

  test(`${mode} - update with skipAuth bypasses the rules`, async t => {
    const { page, run } = await setup(t, saveDispatch)
    const [other] = await page.insert({ inputs: [{ title: 'Theirs', userId: 99 }] })

    const res = await run(async (entity, ctx) => {
      // getPublishTopic reads the user, which skipAuth would otherwise never set up
      await ctx.reply.request.setupDBAuthorizationUser()
      return entity.update({ input: { id: other.id, title: 'Admin' }, ctx, skipAuth: true })
    })
    equal(res.statusCode, 200, res.body)
    equal(res.json().title, 'Admin')
  })
}
