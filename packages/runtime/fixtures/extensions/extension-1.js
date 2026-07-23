export default async function setup ({ runtime, itc, logger, options, root, sharedContext }) {
  const events = (globalThis.__pltExtensionEvents ??= [])
  events.push({ event: 'setup', extension: 'first' })

  // Expose the facades so that tests can drive them from the outside
  globalThis.__pltExtensionItc = itc
  globalThis.__pltExtensionSharedContext = sharedContext

  itc.handle('extension:context', () => {
    return {
      options,
      root,
      hasRuntime: typeof runtime.getApplicationsIds === 'function',
      hasLogger: typeof logger.info === 'function',
      hasSharedContext: typeof sharedContext?.get === 'function' && typeof sharedContext?.update === 'function',
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
