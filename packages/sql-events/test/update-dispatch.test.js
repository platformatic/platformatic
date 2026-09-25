import { connect } from '@platformatic/sql-mapper'
import MQEmitter from 'mqemitter'
import { deepEqual, equal } from 'node:assert'
import { test } from 'node:test'
import { setupEmitter } from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

const fakeLogger = {
  trace () {},
  error () {}
}

async function setup (t, saveDispatch) {
  const mapper = await connect({
    log: fakeLogger,
    ...connInfo,
    saveDispatch,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      t.after(() => db.dispose())

      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42)
        );`)
      } else {
        await db.query(sql`CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL
        );`)
      }
    }
  })

  const mq = MQEmitter()
  setupEmitter({ mapper, mq, log: fakeLogger })

  const topics = []
  await new Promise(resolve => {
    mq.on(
      '/entity/page/#',
      (msg, cb) => {
        topics.push(msg.topic)
        cb()
      },
      resolve
    )
  })

  return { entity: mapper.entities.page, topics }
}

for (const saveDispatch of [false, true]) {
  const mode = `saveDispatch: ${saveDispatch}`

  test(`${mode} - save create publishes exactly once`, async t => {
    const { entity, topics } = await setup(t, saveDispatch)
    const page = await entity.save({ input: { title: 'Hello' } })
    deepEqual(topics, ['/entity/page/save/' + page.id])
  })

  test(`${mode} - save update publishes exactly once`, async t => {
    const { entity, topics } = await setup(t, saveDispatch)
    const [page] = await entity.insert({ inputs: [{ title: 'Hello' }] })
    topics.length = 0

    const res = await entity.save({ input: { id: page.id, title: 'Updated' }, fields: ['title'] })
    deepEqual(res, { title: 'Updated' })
    deepEqual(topics, ['/entity/page/save/' + page.id])
  })

  test(`${mode} - direct update publishes once`, async t => {
    const { entity, topics } = await setup(t, saveDispatch)
    const [page] = await entity.insert({ inputs: [{ title: 'Hello' }] })
    topics.length = 0

    const res = await entity.update({ input: { id: page.id, title: 'Updated' }, fields: ['title'] })
    deepEqual(res, { title: 'Updated' })
    deepEqual(topics, ['/entity/page/save/' + page.id])
  })

  test(`${mode} - direct update on a missing row does not publish`, async t => {
    const { entity, topics } = await setup(t, saveDispatch)
    const res = await entity.update({ input: { id: 42, title: 'Ghost' } })
    equal(res, null)
    deepEqual(topics, [])
  })
}
