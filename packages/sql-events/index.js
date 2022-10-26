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
        const res = await original(data)
        const topic = await entity.getPublishTopic({ action: 'save', data: res, ctx: data.ctx })
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
      insert: multiField('save')
    })

    function multiField (action) {
      return async function (original, data) {
        const fields = new Set(data.fields)
        const res = await original({ ...data, fields: undefined })

        await Promise.all(res.map(async (input) => {
          const topic = await entity.getPublishTopic({ action, data: input, ctx: data.ctx })
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

    entity.getPublishTopic = async function ({ action, data }) {
      if (!data) {
        throw new Error('The object that will be published is required under the data property')
      }

      if (!data[primaryKey]) {
        throw new Error('The primaryKey is necessary inside data')
      }

      switch (action) {
        case 'save':
          return `/entity/${entityName}/save/${data[primaryKey]}`
        case 'delete':
          return `/entity/${entityName}/delete/${data[primaryKey]}`
        default:
          return false
      }
    }

    entity.getSubscriptionTopic = async function ({ action }) {
      switch (action) {
        case 'save':
          return `/entity/${entityName}/save/+`
        case 'delete':
          return `/entity/${entityName}/delete/+`
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
