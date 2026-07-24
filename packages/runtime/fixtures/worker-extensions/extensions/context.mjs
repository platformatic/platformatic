// Reports its context back through a response header, so a test can assert what
// a worker extension receives.
export default function setup ({ applicationId, entrypoint, config, options, logger, capability, onRequest }) {
  const received = {
    applicationId,
    entrypoint,
    hasConfig: typeof config === 'object' && config !== null,
    option: options.marker ?? null,
    hasLogger: typeof logger?.info === 'function',
    hasCapability: capability != null
  }

  onRequest(({ addResponseHeader }) => {
    addResponseHeader('x-extension-context', Buffer.from(JSON.stringify(received)).toString('base64'))
  })
}
