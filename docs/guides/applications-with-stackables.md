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
- **What is the name of the stackable?**
  - `my-stackable`
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
stackable.configType = 'my-stackable-app'
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
  },
  transformConfig: async () => {}
}
```

### Stackable generator

`MyStackableGenerator` is a class extending `BaseGenerator` or any other stackable generator (ServiceGenerator in this example). It's used to generate a Stackable application. You can find an example of a generator in `lib/generator.js`.

```js
'use strict'

const { Generator: ServiceGenerator } = require('@platformatic/service')
const { schema } = require('./schema')

class MyStackableGenerator extends ServiceGenerator {
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
        text: '{PLT_GREETING_TEXT}'
      }
    }
    return Object.assign({}, baseConfig, config)
  }

  async _beforePrepare () {
    super._beforePrepare()

    this.config.env = {
      PLT_GREETING_TEXT: this.config.greeting ?? 'Hello world!',
      ...this.config.env
    }
  }

  async _afterPrepare () {
    this.addFile({
      path: '',
      file: 'stackable.schema.json',
      contents: JSON.stringify(schema, null, 2)
    })
  }
}

module.exports = MyStackableGenerator
module.exports.Generator = MyStackableGenerator
```

This generator extends `ServiceGenerator` which means it will generate an application based on Platformatic Service. If you want to create a Stackable based on Platformatic DB or Platformatic Composer you can extend `DBGenerator` or `ComposerGenerator` respectively.

In addition this generator adds a custom `greeting` property to the Stackable config and generates a `stackable.schema.json` file with the JSON schema of the Stackable config. Greeting text will be taken from the `PLT_GREETING_TEXT` environment variable. Generator will create a `.env` file with the `PLT_GREETING_TEXT` variable set to `Hello world!` by default.

### Stackable schema

`schema` is the JSON schema of the Stackable config. It's used to validate the Stackable config. You can find an example of a schema in `lib/schema.js`.

```js
'use strict'

const { schema } = require('@platformatic/service')

const myStackableSchema = {
  ...schema.schema,
  $id: 'my-stackable',
  title: 'My Stackable Config',
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
  }
}

module.exports.schema = myStackableSchema

if (require.main === module) {
  console.log(JSON.stringify(myStackableSchema, null, 2))
}

```

This schema extends the Platformatic Service schema and adds a custom `greeting` property. You can also use the stackable schema to generate a types file for the Stackable config. To do so, you can use `npm run build:config` cli command.

Note that the `$id` property of the schema identifies the module in our system, allowing us to retrieve the schema correctly. When your stackable is ready you can publish the config schema and use a remote schema url instead. It is recommended, but not required, that the JSON schema is actually published in this location. Doing so allows tooling such as the VSCode language server to provide autocompletion.

__Example__
```json
{
  "$id": "https://example.com/schemas/my-stackable.schema.json"
}

### Stackable CLI

If you chose to use TypeScript, you will need to run `npm run build` first to compile the Stackable.

You can find two scripts in the `cli` folder: `create.js` and `start.js`. These scripts are used to create and start a Stackable application respectively. `package.json` contains two bin commands: `create-my-stackable` and `start-my-stackable` which are used to run these scripts. Note that CLI commands include the Stackable name, so it might be different if you chose a different name for your Stackable.

```json
{
  "bin": {
    "create-my-stackable": "./cli/create.js",
    "start-my-stackable": "./cli/start.js"
  }
}
```

To use these commands before publishing the Stackable to npm you can run `npm link` in the Stackable folder. This will create symlinks to the Stackable scripts in the global folder. After that you can use `create-my-stackable` and `start-my-stackable` commands in any folder.

```bash
npm link
```

### Creating a Stackable application

If you chose to use TypeScript, you will need to run `npm run build` first to compile the Stackable.

To create an application based on your Stackable you can run the `create-my-stackable` cli command. This command uses the `cli/create.js` script to generate the application. By default application will be generated in a `./my-stackable-app` folder. To change the default folder you can use the `--dir` option. For other options check the `cli/create.js` script.

After generating the application you can find a stackable app config file `./app/platformatic.json` with the custom greeting option. Option value is set in a `.env` file as a `PLT_GREETING_TEXT` environment variable.

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
    "text": "{PLT_GREETING_TEXT}"
  }
}
```

You can see that the config uses the local `./stackable.schema.json` file to validate the config. When your stackable is ready you can publish the config schema and use a remote schema url instead.

__Example__
```json
{
  "$schema": "https://example.com/schemas/my-stackable.schema.json"
}
```

### Starting a Stackable application

To start the application you can run the `start-my-stackable` cli command. This command uses the `cli/start.js` script to start the application. By default `start-my-stackable` looks for a project in the current folder. To change the default folder you can use the `-c` option to specify a path to the `platformatic.json` file.

In the logs you should see the custom greeting logged from the stackable `./plugins/example.js` plugin.

```bash
[12:27:10.724] INFO (87553): Loading stackable greeting plugin.
    greeting: {
      "text": "Hello world!"
    }
[12:27:10.730] INFO (87553): Server listening at http://0.0.0.0:3042
```
