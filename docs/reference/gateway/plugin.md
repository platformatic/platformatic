import Issues from '../../getting-started/issues.md';

# Plugin

To extend the functionality of an application in Platformatic, you can register a [plugin](https://fastify.dev/docs/latest/Reference/Plugins/). These plugins are standard [Fastify](https://fastify.io) plugins.

## Plugin Configuration

Specify the location of your plugin files in the configuration file, as shown in the example below. This path is relative to the config file path.

```json
{
  ...
  "plugins": {
    "paths": ["./plugin/index.js"]
  }
}
```
### Creating a Plugin

Your plugin should export an asynchronous function that receives the parameters:

- `app` (`FastifyInstance`): this is the main fastify [instance](https://www.fastify.io/docs/latest/Reference/Server/#instance).
- `opts`: contains all the options specified in the config file after `path`.

#### Example Plugin

Here's a simple example of a Fastify plugin:

```js
module.exports = async function (app, opts) {
  app.get('/hello', async (request, reply) => {
    return 'Hello from Platformatic!';
  });
}
```

## Hot Reload

The plugin file is monitored by the [`fs.watch`](https://nodejs.org/api/fs.html#fspromiseswatchfilename-options) function. There's no need to manually reload the Platformatic Gateway server while developing your plugin. Changes are detected automatically, triggering a server restart to load your updated code.

:::tip

Currently, on Linux, file watching in subdirectories is not supported due to a Node.js limitation, as documented [here](https://nodejs.org/api/fs.html#caveats).

:::

## Directory Structure 

Plugins can also be directories, which are loaded using [`@fastify/autoload`](https://github.com/fastify/fastify-autoload). This approach automatically configures routes matching the folder structure.

### Example Directory Structure

Consider the following directory structure for organizing multiple plugins:

```
├── routes
│   ├── foo
│   │   ├── something.js
│   │   └── bar
│   │       └── baz.js
│   ├── single-plugin
│   │   └── utils.js
│   └── another-plugin.js
└── platformatic.json
```

By default, each folder will be added as a prefix to the routes defined within them. Refer to the [@fastify/autoload](https://github.com/fastify/fastify-autoload) documentation for customization options.

## Loading Multiple Plugins

To load multiple plugins in parallel, specify an array of paths in the configuration:

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

<Issues />
