# @platformatic/bus

A simple Bus implementation for inter-thread communication.

Check out the full documentation for Platformatic DB on [our website](https://docs.platformatic.dev/docs/getting-started/quick-start-guide).

## Install

```sh
npm install @platformatic/bus
```

## Usage

**main.js**

```js
import { Bus } from '@platformatic/bus'

const bus = new Bus('root')
bus.send('worker', 'message')
```

**worker.js**

```js
import { Bus } from '@platformatic/bus'

const bus = new Bus('worker')
bus.on('message', message => console.log(message))
```

## License

Apache 2.0
