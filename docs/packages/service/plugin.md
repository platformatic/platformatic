import Issues from '../../getting-started/issues.md';

# Plugin

To add more features to a Platformatic service, you will need to register a plugin, which will be in the form of a standard [Fastify](https://fastify.io) plugin.

## Configuration

The config file specifies where the plugin file is located. The path is relative to the config file path.

```json title="platformatic.json"
{
  ...
  "plugins": {
    "paths": ["./plugin/index.js"]
  }
}
```

You should export an async `function` which receives the following parameters:

- `app` (`FastifyInstance`) the main fastify [instance](https://www.fastify.io/docs/latest/Reference/Server/#instance)
- `opts` all the options specified in the config file after `path`

## Hot Reload

The plugin file is watched by the [`fs.watch`](https://nodejs.org/api/fs.html#fspromiseswatchfilename-options) function.

You don't need to reload the Platformatic Service server while working on your plugin. Every time you save, the watcher will trigger a reload event, and the server will auto-restart and load your updated code.

:::info
On Linux, file watch in subdirectories is not supported due to a Node.js limitation ([documented here](https://nodejs.org/api/fs.html#caveats)).
:::


## Directories

The path can also be a directory. In that case, the directory will be loaded with [`@fastify/autoload`](https://github.com/fastify/fastify-autoload).

**Example Directory Structure**

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

By default, the folder will be added as a prefix to all the routes defined within them.
See the [autoload](../runtime/configuration.md#autoload) documentation for all the options to customize this behavior.

## Multiple Plugins

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

## TypeScript and Autocompletion

To provide the correct typings of the features added by Platformatic Service to your Fastify instance, add the following at the top of your files:

```js
/// <references types="@platformatic/service" />
```

### Plugin definition with TypeScript

Here is an example of writing a plugin in TypeScript:

```ts
/// <reference types="@platformatic/service" />
import { type FastifyInstance, type FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
}
```

<Issues />
