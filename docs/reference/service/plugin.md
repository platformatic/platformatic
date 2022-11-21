# Plugin

If you want to add features to a service, you will need to register a plugin, which will be in the form of a standard [Fastify](https://fastify.io) plugin.

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

Since it uses [fastify-sandbox](https://github.com/mcollina/fastify-sandbox) under the hood, all other options of that package may be specified under the `plugin` property.

You should export an async `function` which receives a parameters
- `app` (`FastifyInstance`) that is the main fastify [instance](https://www.fastify.io/docs/latest/Reference/Server/#instance)
- `opts` all the options specified in the config file after `path`

## Hot Reload

Plugin file is being watched by [`fs.watch`](https://nodejs.org/api/fs.html#fspromiseswatchfilename-options) function.

You don't need to reload Platformatic Service server while working on your plugin. Every time you save, the watcher will trigger a reload event and the server will auto-restart and load your updated code.

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
