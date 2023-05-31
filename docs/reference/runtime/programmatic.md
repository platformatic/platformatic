# Programmatic API

In many cases it's useful to start Platformatic Runtime using an API instead of
command line, e.g. in tests we want to start and stop our server.

The `buildServer` function allows that:

```js
import { buildServer } from '@platformatic/runtime'

const app = await buildServer('path/to/platformatic.runtime.json')
const entrypointUrl = await app.start()

// Make a request to the entrypoint.
const res = await fetch(entrypointUrl)
console.log(await res.json())

// Do other interesting things.

await app.close()
```

It is also possible to customize the configuration:

```js
import { buildServer } from '@platformatic/runtime'

const app = await buildServer({
  $schema: 'https://platformatic.dev/schemas/v0.26.0/runtime',
  entrypoint: 'entrypointApp',
  autoload: {
    path: './packages',
    exclude: ['docs']
  }
})

const entrypointUrl = await app.start()

// Make a request to the entrypoint.
const res = await fetch(entrypointUrl)
console.log(await res.json())

// Do other interesting things.

await app.close()
```
