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
      async save (original, data, ctx) {
        const topic = await entity.getPublishTopic({ action: 'update', input: data.input, ctx: data.ctx })
        const res = await original(data)
        if (topic) {
          await new Promise((resolve) => {
            mq.emit({
              topic,
              payload: {
                [primaryKey]: res[primaryKey]
              }
            }, resolve)
          })
        }
        return res
      },

      delete: multiField('delete'),
      insert: multiField('create')
    })

    function multiField (action) {
      return async function (original, data) {
        const fields = new Set(data.fields)
        const res = await original({ ...data, fields: undefined })

        await Promise.all(res.map(async (input) => {
          const topic = await entity.getPublishTopic({ action, input, ctx: data.ctx })
          if (topic) {
            return new Promise((resolve) => {
              mq.emit({
                topic,
                payload: input
              }, resolve)
            })
          }
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
    }

    entity.getPublishTopic = async function ({ action, input }) {
      if (!input) {
        return false
      }

      const isNew = input[primaryKey] === undefined
      switch (action) {
        case 'create':
          return `/entity/${entityName}/created`
        case 'update':
          return isNew ? `/entity/${entityName}/created` : `/entity/${entityName}/updated/${input[primaryKey]}`
        case 'delete':
          return `/entity/${entityName}/deleted/${input[primaryKey]}`
        default:
          return false
      }
    }

    entity.getSubscriptionTopic = async function ({ action }) {
      switch (action) {
        case 'create':
          return `/entity/${entityName}/created`
        case 'update':
          return `/entity/${entityName}/updated/+`
        case 'delete':
          return `/entity/${entityName}/deleted/+`
        default:
          throw new Error(`no such action ${action}`)
      }
    }
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
