# Add Custom Functionality

If you want to extend Platformatic DB features, it is possible to register a plugin, which will be in the form of a standard [Fastify](https://fastify.io) plugin.

The config file will specify where the plugin file is located as the example below:

```json
{
  ...
  "plugin": {
    "path": "./plugin/index.js"
  }
}
```
The path is relative to the config file path.

Since it uses [fastify-isolate](https://github.com/mcollina/fastify-isolate) under the hood, all other options of that package may be specified under the `plugin` property.

Once the config file is set up, you can write your plugin

```js
module.exports = async function (app) {
  app.log.info('plugin loaded')
  // Extend GraphQL Schema with resolvers
  app.graphql.extendSchema(`
    extend type Query {
      add(x: Int, y: Int): Int
    }
  `)
  app.graphql.defineResolvers({
    Query: {
      add: async (_, { x, y }) => x + y
    }
  })

  // Create a new route, see https://www.fastify.io/docs/latest/Reference/Routes/ for more info
  app.post('/sum', (req, reply) => {
    const {x, y} = req.body
    return { result: x + y }
  })

  // access platformatic entities data
  app.get('/all-entities', (req, reply) => {
    const entities = Object.keys(app.platformatic.entities)
    return { entities }
  })
}

```
