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
      subscribe: async (_, query, { pubsub }, info) => {
        const topic = `/entity/${field.singularName}/created` 
        const res = await pubsub.subscribe(topic)
        const entity = app.platformatic.entities[field.singularName]
        const primaryKey = entity.primaryKey
        return (async function * () {
          const fields = meta.getFields([{ info }])
          for await (const msg of res) {
            const found = await entity.find({ where: { [primaryKey]: { eq: msg[primaryKey] } }, fields })
            // The following could happen in case of a race condition
            // testing it would be very hard, so we skip it for now
            /* c8 ignore next 4 */
            if (found.length === 0) {
              app.log.warn({ ...msg.payload, entity: field.singularName }, 'could not find element')
              continue
            }
            yield { [created]: found[0] }
          }
        })()
      }
    }
  }
  const subscription = new graphql.GraphQLObjectType({
    name: 'Subscription',
    fields
  })

  return subscription
}

module.exports = setupSubscriptions
