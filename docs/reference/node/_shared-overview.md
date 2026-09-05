import Issues from '../../getting-started/issues.md';

## Runtime APIs

During application execution, Platformatic exposes runtime APIs through typed getters and setters from [`@platformatic/globals`](/docs/reference/runtime/globals).

```js
import { getApplicationId, getLogger } from '@platformatic/globals'

const applicationId = getApplicationId()
const logger = getLogger()

logger.info({ applicationId }, 'Application started')
```

Common APIs include:

- `getLogger()` to access the application logger.
- `getBasePath()` to read the application base path.
- `getMessaging()` to exchange messages with other runtime applications.
- `getPrometheus()` to register custom metrics in the runtime registry.
- `getEvents()` to listen for lifecycle events such as `close`.
- `setCustomHealthCheck()` and `setCustomReadinessCheck()` to customize health and readiness checks.

Use the typed APIs from [`@platformatic/globals`](/docs/reference/runtime/globals); the former `globalThis.platformatic` object is no longer available in v4.

See the [Runtime APIs reference](/docs/reference/runtime/globals) for the complete API list, error handling behavior, and examples.

<Issues />
