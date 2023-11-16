'use strict'

const MQEmitter = require('mqemitter')
const fp = require('fastify-plugin')
const camelcase = require('camelcase')
const { PassThrough } = require('stream')
const MQEmitterRedis = require('mqemitter-redis')
const { promisify } = require('util')
const errors = require('./errors')

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
    // Skip entities with composite primary keys
    /* istanbul ignore next */
    if (entity.primaryKeys.size !== 1) {
      continue
    }
    const primaryKey = camelcase(entity.primaryKeys.values().next().value)
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

      delete: multiElement('delete'),
      insert: multiElement('save')
    })

    function multiElement (action) {
      return async function (original, data) {
        const ctx = data.ctx
        /* istanbul ignore next */
        const _log = ctx?.reply?.request?.log || log
        const res = await original(data)

        await Promise.all(res.map(async (payload) => {
          const topic = await entity.getPublishTopic({ action, data: payload, ctx })
          if (topic) {
            _log.trace({ topic, payload }, 'publishing event')
            return new Promise((resolve) => {
              mq.emit({
                topic,
                payload: {
                  [primaryKey]: payload[primaryKey]
                }
              }, resolve)
            })
          }
        }))

        return res
      }
    }

    // getPublishTopic is async because it could be overridden to be asynchronous
    entity.getPublishTopic = async function ({ action, data }) {
      if (!data) {
        throw new errors.ObjectRequiredUnderTheDataProperty()
      }

      if (!data[primaryKey]) {
        console.log('*************',data)
        throw new errors.PrimaryKeyIsNecessaryInsideData()
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

    // getSubscriptionTopic is async because it could be overridden to be asynchronous
    entity.getSubscriptionTopic = async function ({ action }) {
      switch (action) {
        case 'save':
          return `/entity/${entityName}/save/+`
        case 'delete':
          return `/entity/${entityName}/delete/+`
        default:
          throw new errors.NoSuchActionError(action)
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
module.exports.errors = errors
