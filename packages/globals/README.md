# @platformatic/globals

Typed accessors for Platformatic runtime APIs.

Applications use `@platformatic/globals` to read runtime context, use the shared logger, exchange messages, register metrics, customize health checks, and publish metadata while running inside Watt or Platformatic Runtime.

## Install

```sh
npm install @platformatic/globals
```

## Usage

```js
import { getApplicationId, getLogger, getMessaging } from '@platformatic/globals'

const applicationId = getApplicationId()
const logger = getLogger()
const messaging = getMessaging()

logger.info({ applicationId }, 'Application started')

messaging.handle('ping', () => 'pong')
```

Runtime APIs are injected when the application runs inside Watt or Platformatic Runtime. Most getters throw when the requested API is not available. Pass `{ throwOnMissing: false }` to return `undefined` instead:

```js
import { getBasePath } from '@platformatic/globals'

const basePath = getBasePath({ throwOnMissing: false }) ?? ''
```

Direct access through the legacy `globalThis.platformatic` object is still supported for compatibility, but deprecated. Use the typed getters and setters instead.

## Documentation

See the [Runtime APIs reference](https://docs.platformatic.dev/docs/reference/runtime/configuration) for the complete API list and examples.

## License

Apache 2.0
