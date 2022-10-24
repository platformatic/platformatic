'use strict'

const graphql = require('graphql')

function setupSubscriptions (app, metaMap, resolvers) {
  const fields = {}
  resolvers.Subscription = {}
  for (const [field, meta] of metaMap) {
    const { type } = meta
    const created = `${field.singularName}Created`
    fields[created] = {
      type
    }
    resolvers.Subscription[created] = {
      subscribe: async (_, query, ctx, info) => {
        const { pubsub } = ctx
        const entity = app.platformatic.entities[field.singularName]
        const topic = await entity.getSubscriptionTopic({ action: 'create', ctx })
        const res = await pubsub.subscribe(topic)
        return augment(res, meta, info, app, field, created, ctx)
      }
    }

    const updated = `${field.singularName}Updated`
    fields[updated] = {
      type
    }
    resolvers.Subscription[updated] = {
      subscribe: async (_, query, ctx, info) => {
        const { pubsub } = ctx
        const entity = app.platformatic.entities[field.singularName]
        const topic = await entity.getSubscriptionTopic({ action: 'update', ctx })
        const res = await pubsub.subscribe(topic)
        return augment(res, meta, info, app, field, updated, ctx)
      }
    }

    const deleted = `${field.singularName}Deleted`
    fields[deleted] = {
      type
    }
    resolvers.Subscription[deleted] = {
      subscribe: async (_, query, ctx, info) => {
        const { pubsub } = ctx
        const entity = app.platformatic.entities[field.singularName]
        const topic = await entity.getSubscriptionTopic({ action: 'delete', ctx })
        const res = await pubsub.subscribe(topic)
        return wrap(res, deleted)
      }
    }
  }
  const subscription = new graphql.GraphQLObjectType({
    name: 'Subscription',
    fields
  })

  return subscription
}

async function * wrap (iterator, key) {
  for await (const msg of iterator) {
    yield { [key]: msg }
  }
}

async function * augment (iterator, meta, info, app, field, key, ctx) {
  const entity = app.platformatic.entities[field.singularName]
  const primaryKey = entity.primaryKey
  const fields = meta.getFields([{ info }])
  for await (const msg of iterator) {
    try {
      app.log.trace({ msg, entity: field.singularName }, 'graphql subscription augmenting data')
      const found = await entity.find({ where: { [primaryKey]: { eq: msg[primaryKey] } }, fields, ctx })
      // The following could happen in case of a race condition
      // testing it would be very hard, so we skip it for now
      /* istanbul ignore next */
      if (found.length === 0) {
        app.log.warn({ ...msg.payload, entity: field.singularName }, 'graphql subscription could not find element')
        continue
      }
      const toYield = { [key]: found[0] }
      app.log.trace({ yield: toYield, entity: field.singularName }, 'graphql subscription augmented data')
      yield toYield
    } catch (err) {
      /* istanbul ignore next */
      app.log.warn({ err, entity: field.singularName }, 'graphql subscription error')
    }
  }
}

module.exports = setupSubscriptions
