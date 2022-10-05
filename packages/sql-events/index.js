'use strict'

const MQEmitter = require('mqemitter')
const fp = require('fastify-plugin')
const { PassThrough } = require('stream')

async function fastifySqlEvents (app, opts) {
  setupEmitter({ ...opts, mapper: app.platformatic })
}

function setupEmitter ({ mq, mapper }) {
  mq = mq || new MQEmitter()
  for (const entityName of Object.keys(mapper.entities)) {
    const entity = mapper.entities[entityName]
    const { primaryKey } = entity
    mapper.addEntityHooks(entityName, {
      async insert (original, data) {
        const res = await original(data)
        await Promise.all(res.map((data) => {
          const topic = `/entity/${entityName}/created`
          return new Promise((resolve) => {
            mq.emit({
              topic,
              payload: {
                [primaryKey]: data[primaryKey]
              }
            }, resolve)
          })
        }))
        return res
      },
      async save (original, data) {
        const isNew = data.input[primaryKey] === undefined
        const topic = isNew ? `/entity/${entityName}/created` : `/entity/${entityName}/updated/${data.input[primaryKey]}`
        const res = await original(data)
        await new Promise((resolve) => {
          mq.emit({
            topic,
            payload: {
              [primaryKey]: res[primaryKey]
            }
          }, resolve)
        })
        return res
      },
      async delete (original, data) {
        const fields = new Set(data.fields)
        const res = await original({ ...data, fields: undefined })
        await Promise.all(res.map((data) => {
          const topic = `/entity/${entityName}/deleted/${data[primaryKey]}`
          return new Promise((resolve) => {
            mq.emit({
              topic,
              payload: data
            }, resolve)
          })
        }))

        if (fields.size > 0) {
          const actual = []
          for (const element of res) {
            const obj = {}
            for (const field of fields) {
              obj[field] = element[field]
            }
            actual.push(obj)
          }
          return actual
        } else {
          return res
        }
      }
    })
  }

  mapper.mq = mq
  mapper.subscribe = subscribe

  function subscribe (topics) {
    topics = typeof topics === 'string' ? [topics] : topics
    const stream = new PassThrough({ objectMode: true })
    const forward = stream.write.bind(stream)
    stream.on('close', function () {
      for (const topic of topics) {
        mq.removeListener(topic, forward, noop)
      }
    })
    return Promise.all(topics.map((topic) => {
      return new Promise((resolve) => mq.on(topic, forward, resolve))
    })).then(() => stream)
  }
}

function noop () {}

module.exports = fp(fastifySqlEvents)
module.exports.setupEmitter = setupEmitter
