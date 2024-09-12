# @platformatic/itc

Inter-Thread Communication (ITC) is a library for managing communication between threads in a multi-threaded application.

## Install

```sh
npm install @platformatic/itc
```

## Usage

```js
const { MessageChannel } = require('node:worker_threads')
const { ITC } = require('@platformatic/itc')
const { port1, port2 } = new MessageChannel()


// thread 1
const itc1 = new ITC({ port: port1, name: 'thread-1' })

itc1.handle('get-users', async (request) => {
  return [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
})

itc1.listen()

// thread 2
const itc2 = new ITC({ port: port2, name: 'thread-2' })
itc2.listen()

const users = await itc2.send('get-users')
console.log(users)
```

## License

Apache 2.0
