'use strict'

const { join } = require('path')
const Static = require('@fastify/static')

module.exports = async function (app, opts = {}) {
  app.register(Static, {
    root: join(__dirname, '../static'),
    wildcard: false,
    serve: false
  })

  app.get('/graphiql', (req, reply) => {
    reply.sendFile('graphiql.html')
  })

  app.get('/graphiql/main.js', (req, reply) => {
    reply.sendFile('main.js')
  })

  app.get('/graphiql/sw.js', (req, reply) => {
    reply.sendFile('sw.js')
  })

  app.get('/graphiql/config.js', (req, reply) => {
    const graphqlPath = '/graphql'
    const configRows = [
      `window.GRAPHQL_ENDPOINT = '${app.prefix}${graphqlPath}'`
    ]

    const plugins = []
    /* c8 ignore next 8 */
    const idePlugins = opts.ide?.plugins || []
    idePlugins.forEach(plugin => {
      if (plugin.name) {
        configRows.push(`window.GRAPIHQL_PLUGIN_${plugin.name.toUpperCase()} = ${JSON.stringify(plugin)}`)
        plugins.push(plugin.name)
      } else {
        app.log.warn('Graphiql plugin without a name defined')
      }
    })

    configRows.push(`window.GRAPHIQL_PLUGIN_LIST = ${JSON.stringify(plugins)}`)

    reply
      .header('Content-Type', 'application/javascript')
      .send(configRows.join(';\n'))
  })
}
