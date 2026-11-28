# `@platformatic/workflowsdk`

This package provides the Platformatic capability for Workflow SDK remote
handlers. It owns handler lifecycle and adapts the protocol runtime from
`@platformatic/remote-workflow` to a host-provided control plane.

The capability deliberately does not open a socket or own authentication,
reconnects, request correlation, or registry storage. The host supplies
`registerManifest()` and `createHandlerTransport()` implementations:

```js
import { createWorkflowSDKCapability } from '@platformatic/workflowsdk'

const capability = createWorkflowSDKCapability({
  root: process.env.PLT_APP_DIR,
  identity: {
    tenant: applicationId,
    service: applicationName,
    versionLabel: deploymentVersion
  },
  controlPlane,
})

await capability.start()
```

`start()` is a no-op when the control plane, the private
`.well-known/workflow/v1/remote-handlers.json` artifact, the matching public
`.well-known/workflow/v1/remote-manifest.json` artifact, or the handler
identity is unavailable. When both artifacts are present, the capability
registers the public endpoint schemas through the control plane before
starting the private handler worker. A malformed manifest, hash conflict, or
control-plane/runtime failure is surfaced to the caller. `stop()` closes the
handler worker; `setControlPlane()` replaces the control plane during a
runtime reconfiguration.

For a local or self-managed Watt deployment, use the in-process adapter:

```js
import {
  createLocalRemoteHandlerControlPlane,
  createWorkflowSDKCapability
} from '@platformatic/workflowsdk'

const controlPlane = createLocalRemoteHandlerControlPlane()
const capability = createWorkflowSDKCapability({
  root: process.env.PLT_APP_DIR,
  identity: { service: 'inventory', versionLabel: 'local' },
  controlPlane
})

await capability.start()
```

The local adapter exposes `dispatch()` for callers managed by the same Watt
process. A durable self-managed deployment can implement the same control
plane interface over its own store or broker.

The package resolves `@platformatic/remote-workflow/runtime` from the application root
at runtime. It therefore stays optional for applications that do not build
remote handlers and does not impose an ICC dependency.
