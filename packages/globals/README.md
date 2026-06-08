# @platformatic/globals

Platformatic Globals exports access to Platformatic runtime APIs.

## Install

```sh
npm install @platformatic/globals
```

## Usage

```ts
import { getApplicationId, getCapability, getClosing, getMessaging } from '@platformatic/globals'

const applicationId = getApplicationId()
const capability = getCapability()
const closing = getClosing()
const messaging = getMessaging()
```

Direct access through the legacy global object is still supported for compatibility, but deprecated. Use the typed getters instead.

## License

Apache 2.0
