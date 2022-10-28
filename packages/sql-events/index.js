'use strict'

const MQEmitter = require('mqemitter')
const fp = require('fastify-plugin')
const { PassThrough } = require('stream')
const MQEmitterRedis = require('mqemitter-redis')
const { promisify } = require('util')

async function fastifySqlEvents (app, opts) {
  setupEmitter({ ...opts, mapper: app.platformatic, log: app.log })
  const mq = app.platformatic.mq
  app.addHook('onClose', () => promisify(mq.close.bind(mq)))
}

function setupEmitter ({ log, mq, mapper, connectionString }) {
  if (connectionString) {
    mq = MQEmitterRedis({ connectionString })
  } else if (!mq) {
    mq = MQEmitter()
  }

  for (const entityName of Object.keys(mapper.entities)) {
    const entity = mapper.entities[entityName]
    const { primaryKey } = entity
    mapper.addEntityHooks(entityName, {
      async save (original, data) {
        const ctx = data.ctx
        /* istanbul ignore next */
        const _log = ctx?.reply?.request?.log || log
        const res = await original(data)
        const topic = await entity.getPublishTopic({ action: 'save', data: res, ctx })
        if (topic) {
          const payload = {
            [primaryKey]: res[primaryKey]
          }
          _log.trace({ topic, payload }, 'publishing event')
          await new Promise((resolve) => {
            mq.emit({
              topic,
              payload
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
        const ctx = data.ctx
        /* istanbul ignore next */
        const _log = ctx?.reply?.request?.log || log
        const fields = new Set(data.fields)
        const res = await original({ ...data, fields: undefined })

        await Promise.all(res.map(async (payload) => {
          const topic = await entity.getPublishTopic({ action, data: payload, ctx })
          if (topic) {
            _log.trace({ topic, payload }, 'publishing event')
            return new Promise((resolve) => {
              mq.emit({
                topic,
                payload
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
