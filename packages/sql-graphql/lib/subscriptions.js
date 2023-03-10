'use strict'

const graphql = require('graphql')
const camelcase = require('camelcase')

function setupSubscriptions (app, metaMap, resolvers, ignores) {
  const fields = {}
  resolvers.Subscription = {}
  for (const [field, meta] of metaMap) {
    if (ignores.indexOf(field.singularName) >= 0) {
      continue
    }
    // TODO currently we are not supporting subscriptions for
    // entities that have a composite primary key
    /* istanbul ignore next */
    if (field.primaryKeys.size !== 1) {
      continue
    }
    const entity = app.platformatic.entities[field.singularName]
    const primaryKey = camelcase(entity.primaryKeys.values().next().value)
    const { type } = meta
    const saved = `${field.singularName}Saved`
    fields[saved] = {
      type
    }
    resolvers.Subscription[saved] = {
      subscribe: async function * (_, query, ctx, info) {
        const log = ctx.reply.request.log
        const { pubsub } = ctx
        const topic = await entity.getSubscriptionTopic({ action: 'save', ctx })
        log.trace({ topic }, 'subscribed')
        const res = await pubsub.subscribe(topic)
        const fields = meta.getFields([{ info }])

        for await (const msg of res) {
          // TODO optimize this by not calling find() if the subscriber is only asking for the id.
          try {
            log.trace({ msg, entity: field.singularName }, 'graphql subscription augmenting data')
            // The alternative to augmenting the data is installing a resolver for every type
            // of a given entity that loads up the type via a dataloader.
            const found = await entity.find({ where: { [primaryKey]: { eq: msg[primaryKey] } }, fields, ctx })
            // The following could happen in case of a race condition
            // testing it would be very hard, so we skip it for now
            /* istanbul ignore next */
            if (found.length === 0) {
              log.warn({ ...msg.payload, entity: field.singularName }, 'graphql subscription could not find element')
              continue
            }
            const toYield = { [saved]: found[0] }
            log.trace({ yield: toYield, entity: field.singularName }, 'graphql subscription augmented data')
            yield toYield
          } catch (err) {
            /* istanbul ignore next */
            log.warn({ err, entity: field.singularName }, 'graphql subscription error')
          }
        }
      }
    }

    const deleted = `${field.singularName}Deleted`
    fields[deleted] = {
      type: new graphql.GraphQLObjectType({
        name: `${field.name}Deleted`,
        fields: {
          [primaryKey]: {
            type: meta.fields[primaryKey].type
          }
        }
      })
    }
    resolvers.Subscription[deleted] = {
      subscribe: async (_, query, ctx, info) => {
        const { pubsub } = ctx
        const topic = await entity.getSubscriptionTopic({ action: 'delete', ctx })
        const res = await pubsub.subscribe(topic)
        ctx.reply.request.log.trace({ topic }, 'subscribed')
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

module.exports = setupSubscriptions
