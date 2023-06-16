# Plugin

If you want to extend Platformatic DB features, it is possible to register a plugin, which will be in the form of a standard [Fastify](https://fastify.io) plugin.

The config file will specify where the plugin file is located as the example below:

```json
{
  ...
  "plugins": {
    "paths": ["./plugin/index.js"]
  }
}
```
The paths are relative to the config file path.

Once the config file is set up, you can write your plugin to extend Platformatic DB API or write your custom business logic.

You should export an async `function` which receives a parameters
- `app` (`FastifyInstance`) that is the main fastify [instance](https://www.fastify.io/docs/latest/Reference/Server/#instance) running Platformatic DB
- `opts` all the options specified in the config file after `path`
-
You can always access Platformatic [data mapper](/reference/sql-mapper/introduction.md) through `app.platformatic` property.

:::info
To make sure that a user has the appropriate set of permissions to perform any action on an entity the `context` should be passed to the `entity mapper` operation like this:

```js
app.post('/', async (req, reply) => {
  const ctx = req.createPlatformaticCtx()

  await app.platformatic.entities.movies.find({
    where: { /*...*/ },
    ctx
  })
})
```
:::

Check some [examples](/guides/add-custom-functionality/introduction.md).

## Hot Reload

Plugin file is being watched by [`fs.watch`](https://nodejs.org/api/fs.html#fspromiseswatchfilename-options) function.

You don't need to reload Platformatic DB server while working on your plugin. Every time you save, the watcher will trigger a reload event and the server will auto-restart and load your updated code.

:::tip

At this time, on Linux, file watch in subdirectories is not supported due to a Node.js limitation (documented [here](https://nodejs.org/api/fs.html#caveats)).

:::

## Directories

The path can also be a directory. In that case, the directory will be loaded with [`@fastify/autoload`](https://github.com/fastify/fastify-autoload).

Consider the following directory structure:

```
├── routes
│   ├── foo
│   │   ├── something.js
│   │   └── bar
│   │       └── baz.js
│   ├── single-plugin
│   │   └── utils.js
│   └── another-plugin.js
└── platformatic.service.json
```

By default the folder will be added as a prefix to all the routes defined within them.
See the autoload documentation for all the options to customize this behavior.

## Multiple plugins

Multiple plugins can be loaded in parallel by specifying an array:

```json
{
  ...
  "plugins": {
    "paths": [{
      "path": "./plugin/index.js"
    }, {
      "path": "./routes/"
    }]
  }
}
```
