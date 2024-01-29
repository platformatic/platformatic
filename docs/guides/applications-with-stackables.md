# Use Stackables to build Platformatic applications

[Platformatic Service](/docs/reference/db/introduction.md) and [Platformatic DB](/docs/reference/db/introduction.md)
offer a good starting point to create new applications. However, most developers or organizations might want to
create reusable services or applications built on top of Platformatic.
We call these reusable services "Stackables" because you can create an application by stacking services on top of them.

This is useful to publish the application on the public npm registry (or a private one!), including building your own CLI,
or to create a specialized template for your organization to allow for centralized bugfixes and updates.

This process is the same one we use to maintain Platformatic DB and Platformatic Composer on top of Platformatic Service.

## Creating a custom Service

To create a custom Platformatic Stackable you can use the `create-platformatic` CLI command:

```bash
npx create-platformatic@latest
```

- **What kind of project do you want to create?**
  - `Stackable`
- **Where would you like to create your project?**
  - `.`
- **Do you want to use TypeScript?**
  - `no`
- **Do you want to init the git repository?**
  - `no`

After installing the dependencies, let's take a look at the project structure:

```bash
.
├── cli
│   ├── create.js
│   └── index.js
├── lib
│   ├── generator.js
│   └── schema.js
├── plugins
│   └── example.js
├── config.d.ts
├── index.d.ts
├── index.js
└── package.json
```

### Stackable plugin

`index.js` is the entry point of the Stackable. It exports a custom `stackable` function with all required information to be used by Platformatic Service. `stackable` is a fastify plugin so you can register any custom plugins, routes, hooks in it.

```js
async function stackable (fastify, opts) {
  await fastify.register(platformaticService, opts)
  await fastify.register(require('./plugins/example'), opts)
}
```

`platformaticService` is used here as a base for the Stackable. In the same way, you can use `platformaticDB`, `platformaticComposer` or even skip it if you want to create a custom Stackable from scratch.

Each Stackable should have a few required properties attached to the `stackable` function:

- `stackable.configType`: The name of the Stackable.
- `stackable.schema`: The JSON schema of the Stackable config.
- `stackable.generator`: a class extending `BaseGenerator` or any other stackable generator. Used to generate the Stackable application.
- `stackable.configManagerConfig`: ab object with the config for the `ConfigManager` class. Used to manage the Stackable config.

```js
stackable.configType = 'stackable'
stackable.schema = schema
stackable.Generator = Generator
stackable.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  }
}
```

### Stackable generator

`Generator` is a class extending `BaseGenerator` or any other stackable generator. It's used to generate the Stackable application. You can find an example of a generator in `lib/generator.js`.

```js
class Generator extends ServiceGenerator {
  getDefaultConfig () {
    const defaultBaseConfig = super.getDefaultConfig()
    const defaultConfig = {
      greeting: 'Hello world!'
    }
    return Object.assign({}, defaultBaseConfig, defaultConfig)
  }

  async _getConfigFileContents () {
    const baseConfig = await super._getConfigFileContents()
    const config = {
      $schema: './stackable.schema.json',
      greeting: {
        text: this.config.greeting ?? 'Hello world!'
      }
    }
    return Object.assign({}, baseConfig, config)
  }

  async _afterPrepare () {
    this.addFile({
      path: '',
      file: 'stackable.schema.json',
      contents: JSON.stringify(schema, null, 2)
    })
  }
}
```

This generator extends `ServiceGenerator` which means it will generate an application based on Platformatic Service. If you want to create a Stackable based on Platformatic DB or Platformatic Composer you can extend `DBGenerator` or `ComposerGenerator` respectively.

In addition this generator adds a custom `greeting` property to the Stackable config and generates a `stackable.schema.json` file with the JSON schema of the Stackable config.

### Stackable schema

`schema` is the JSON schema of the Stackable config. It's used to validate the Stackable config. You can find an example of a schema in `lib/schema.js`.

```js
const stackableSchema = {
  ...schema.schema,
  $id: 'stackable',
  title: 'Stackable Config',
  properties: {
    ...schema.schema.properties,
    greeting: {
      type: 'object',
      properties: {
        text: {
          type: 'string'
        }
      },
      required: ['text'],
      additionalProperties: false
    }
  },
}
```

This schema extends the Platformatic Service schema and adds a custom `greeting` property. You can also use the stackable schema to generate a types file for the Stackable config. To do so, you can use `npm run build:config` cli command.

### Creating a Stackable application

If you chose to use TypeScript, you will need to run `npm run build` first to compile the Stackable.

To create an application based on a Stackable you can run the `npm run create` cli command. This command uses the `cli/create.js` script to generate the application. By default application will be generated in the `./app` folder. As a next step you need to install the dependencies.

if you open a `./app/platformatic.json` file you will find a custom `greeting` property added to the Stackable config.

```json
{
  "$schema": "./stackable.schema.json",
  "server": {
    "hostname": "{PLT_SERVER_HOSTNAME}",
    "port": "{PORT}",
    "logger": {
      "level": "{PLT_SERVER_LOGGER_LEVEL}"
    }
  },
  "service": {
    "openapi": true
  },
  "watch": true,
  "plugins": {
    "paths": [
      {
        "path": "./plugins",
        "encapsulate": false
      },
      "./routes"
    ]
  },
  "greeting": {
    "text": "Hello world!"
  }
}
```

### Starting a Stackable application

To start the application you can run the `npm run start` cli command. This command uses the `cli/start.js` script to start the application. By default application will be started from the `./app` folder.

In the logs you should see the custom greeting logged from the `./plugins/example.js` plugin.

```bash
[12:27:10.724] INFO (87553): Loading stackable greeting plugin.
    greeting: {
      "text": "Hello world!"
    }
[12:27:10.730] INFO (87553): Server listening at http://0.0.0.0:3042
```
