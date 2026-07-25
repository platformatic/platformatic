// A worker extension: adds a response header on the entrypoint, proving the
// hook fires and addResponseHeader survives to the browser -- for both in-thread
// and child-process entrypoints.
export default function setup ({ applicationId, options, onRequest }) {
  const header = options.header ?? 'x-worker-extension'

  onRequest(({ addResponseHeader }) => {
    addResponseHeader(header, applicationId)
  })

  return {
    close () {
      globalThis.__workerExtensionClosed = true
    }
  }
}
