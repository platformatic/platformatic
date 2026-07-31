import { onEntrypointRequest } from '@platformatic/basic'

// A worker extension: adds a response header on the entrypoint, proving the
// hook fires and addResponseHeader survives to the browser -- for both in-thread
// and child-process entrypoints.
export default function setup ({ applicationId, options }) {
  const header = options.header ?? 'x-worker-extension'

  const unsubscribe = onEntrypointRequest(({ addResponseHeader }) => {
    addResponseHeader(header, applicationId)
  })

  return {
    close () {
      unsubscribe()
      globalThis.__workerExtensionClosed = true
    }
  }
}
