export default async function setup ({ runtime, itc, logger, options, root }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'first' })

  // Expose the facade so that tests can drive it from the outside
  globalThis.__pltExtensionItc = itc

  itc.handle('extension:context', () => {
    return {
      options,
      root,
      hasRuntime: typeof runtime.getApplicationsIds === 'function',
      hasLogger: typeof logger.info === 'function',
      applications: runtime.getApplicationsIds()
    }
  })

  itc.handle('extension:sum', ({ x, y }) => x + y)

  return {
    close () {
      events.push({ event: 'close', extension: 'first' })
    }
  }
}
