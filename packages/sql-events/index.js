'use strict'

const MQEmitter = require('mqemitter')
const fp = require('fastify-plugin')
const { PassThrough } = require('stream')

async function fastifySqlEvents (fastify, opts) {
  // const emitter = new MQEmitter(opts)

  // fastify.decorate('sqlEvents', emitter)
}

function setupEmitter ({ mq, mapper }) {
  for (const entityName of Object.keys(mapper.entities)) {
    const entity = mapper.entities[entityName]
    const { primaryKey } = entity
    mapper.addEntityHooks(entityName, {
      async save (original, data) {
        const isNew = data.input[primaryKey] === undefined
        const topic = isNew ? `/entity/${entityName}/create` : `/entity/${entityName}/update/${data.input[primaryKey]}`
        const res = await original(data)
        await new Promise((resolve) => {
          mq.emit({ 
            topic,
            [entityName]: res
          }, resolve)
        })
        return res
      },
      async delete  (original, data) {
        const res = await original(data)
        await Promise.all(res.map((data) => {
          const topic = `/entity/${entityName}/delete/${data[primaryKey]}`
          return new Promise((resolve) => {
            mq.emit({ 
              topic,
              [entityName]: data
            }, resolve)
          })
        }))
        return res
      }
    })
  }

  mapper.mq = mq
  mapper.subscribe = subscribe
  
  return

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
