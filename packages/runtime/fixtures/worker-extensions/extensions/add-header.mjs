// A worker extension: adds a response header on the entrypoint, proving the
// hook fires and addResponseHeader survives to the browser -- for both in-thread
// and child-process entrypoints.
export default function setup ({ applicationId, entrypoint, options, onRequest }) {
  const header = options.header ?? 'x-worker-extension'

  onRequest(({ request, addResponseHeader }) => {
    addResponseHeader(header, `${applicationId}:${entrypoint}`)
  })

  return {
    close () {
      globalThis.__workerExtensionClosed = true
    }
  }
}
