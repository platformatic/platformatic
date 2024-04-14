# Programmatic API

In many cases it's useful to start Platformatic Composer using an API instead of
command line, e.g. in tests we want to start and stop our server.

The `buildServer` function allows that:

```js
import { buildServer } from '@platformatic/composer'

const app = await buildServer('path/to/platformatic.composer.json')
await app.start()

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```

It is also possible to customize the configuration:


```js
import { buildServer } from '@platformatic/composer'

const app = await buildServer({
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  services: [
    {
      id: 'auth-service',
      origin: 'https://auth-service.com',
      openapi: {
        url: '/documentation/json',
        prefix: 'auth'
      }
    },
    {
      id: 'payment-service',
      origin: 'https://payment-service.com',
      openapi: {
        file: './schemas/payment-service.json'
      }
    }
  ]
})

await app.start()

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```
