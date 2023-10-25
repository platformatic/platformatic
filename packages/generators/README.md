# Platformatic Generator

Generates a Platformatic app programmatically.

## Extending default class

The base class `BaseGenerator` is basically a file writer with some default behaviours.

It should be instantiated with an `options` object having this properties
- `type`: `"db" | "service" | "composer"`
- `logger`: A pino-like logger object. If not provided a fake logger with no output will be used
- `questions`: An array of custom questions object to provide to `inquirer`. Default to `[]`

The `setConfig({...})` function should be called to set the config generator. `BaseGenerator` supports the bare minumium set of options which are common to all types of apps

- `targetDirectory` Where in the local filesystem the app will be created
- `port`: The port where the app should listen
- `hostname`: The hostname where the app should listen
- `plugin`: Whether to create or not a sample plugin file structure
- `typescript`: `true|false`
- `initGitRepository`: Inits the git repository
- `dependencies`: A key value object to add dependencies in `package.json` file
- `devDependencies`: A key value object to add dev-dependencies in `package.json` file
- `staticWorkspaceGitHubActions`: Creates the GitHub action to deploy in a static workspace in Platformatic Cloud
- `dynamicWorkspaceGitHubActions`: Creates the GitHub action to deploy in a dynamic workspace in Platformatic Cloud
- `env`: A key/value object that will be automatically appended to the generated `.env` file
## Usage

This is the simplest example to create a Platformatic Service app into `/path/to/app`

```js
const { BaseGenerator } = require('@platformatic/generators')

async function main() {
  const gen = new BaseGenerator({
    type: 'service'    
  })
  gen.setConfig({
    targetDirectory: '/path/to/app'
  })
  await gen.run()
}

main()
```

The `run()` function will call the `prepare()` function which prepare all files in memory, which will be written by the `writeFiles()` function.

### Hooks

In order to customize the behavior of a subclass there are some functions that may be implemented

#### `_getConfigFileContents`

Returns an object that will be serialized with `JSON.stringify` method. It will be saved in the `platformatic.${TYPE}.json` file

#### `_beforePrepare`

Called from `prepare` function. You have already access to the current `fastify` version (`this.fastifyVersion`) and `platformatic` version (`this.platformaticVersion`)

#### `_afterPrepare`

Called at the end of `prepare` function body

#### `_generateEnv`

The `BaseGenerator` will create an empty `.env` file. In this function you can customize and append other values that may be needed. The values in `this.config.env` object will be automatically appended after this method is called.