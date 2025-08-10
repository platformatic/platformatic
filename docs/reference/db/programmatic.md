import Issues from '../../getting-started/issues.md';

# Programmatic API

Platformatic DB allows starting and managing database instances programmatically using JavaScript, offering a flexible way to integrate database operations into your applications or scripts.

```js
import { create } from '@platformatic/db'

const app = await create('/path/to/platformatic.db.json')

await app.start() // This starts the server.
console.log('Server URL:', app.url)

const res = await fetch(app.url)
console.log('Server response:', await res.json())

// Additional operations can be performed here.

await app.close() // This stops the server.
```

## Customizing Configuration

You can customize the server configuration to meet specific requirements, such as setting a custom hostname or database connection string:

```js
import { create } from '@platformatic/db'

const app = await create('/path/to', {
  server: {
    hostname: '127.0.0.1',
    port: 0
  },
  db: {
    connectionString: 'sqlite://test.sqlite'
  },
})

await app.start() // this will start our server

console.log('URL', app.url)

const res = await fetch(app.url)
console.log(await res.json())

// do something

await app.close()
```

For more details on how this is implemented, read [Platformatic Service Programmatic API](../service/programmatic.md).

<Issues />
